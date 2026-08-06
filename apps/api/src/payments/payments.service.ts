import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PaymentStatus, Prisma, RefundStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BkashService } from "./bkash.service";

export type PaymentEventInput = {
  type: string;
  message: string;
  fromStatus?: PaymentStatus | null;
  toStatus?: PaymentStatus | null;
  actorId?: string | null;
  source?: "gateway" | "admin" | "system" | "customer";
  payload?: unknown;
};

/**
 * Single owner of payment state.
 *
 * Every transition goes through here so that three things always happen
 * together: the row changes, an immutable PaymentEvent is written, and the
 * parent order's payment status is recomputed. Previously these were spread
 * across the bKash controller and the experience service, which is why some
 * transitions were audited and others silently were not.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bkash: BkashService
  ) {}

  /** Append-only; never updated or deleted alongside the payment it describes. */
  async recordEvent(
    paymentId: string,
    event: PaymentEventInput,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const eventClient = client as Prisma.TransactionClient & {
      paymentEvent: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    };

    return eventClient.paymentEvent.create({
      data: {
        paymentId,
        type: event.type,
        message: event.message,
        fromStatus: event.fromStatus ?? undefined,
        toStatus: event.toStatus ?? undefined,
        actorId: event.actorId ?? undefined,
        source: event.source ?? "system",
        payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }

  /**
   * Recomputes an order's payment status from its payment and refund rows.
   * Derived rather than assumed, so a corrected payment always drags the order
   * back into agreement with it.
   */
  async reconcileOrderPaymentStatus(
    client: Prisma.TransactionClient,
    orderId: string
  ) {
    const order = await client.order.findUnique({
      where: { id: orderId },
      select: { total: true }
    });
    if (!order) throw new NotFoundException("Order not found.");

    const [captured, refunded, pendingCount, failedCount] = await Promise.all([
      client.payment.aggregate({
        // REFUNDED payments must stay in this sum. It measures money that was
        // captured, not money still held: dropping them once a refund settles
        // sends the captured total to zero, which made a fully refunded order
        // fall through to PARTIALLY_REFUNDED instead of REFUNDED.
        where: {
          orderId,
          status: {
            in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED]
          }
        },
        _sum: { amount: true }
      }),
      client.refund.aggregate({
        where: { orderId, status: RefundStatus.COMPLETED },
        _sum: { amount: true }
      }),
      client.payment.count({ where: { orderId, status: PaymentStatus.PENDING } }),
      client.payment.count({ where: { orderId, status: PaymentStatus.FAILED } })
    ]);

    const capturedAmount = Number(captured._sum.amount ?? 0);
    const refundedAmount = Number(refunded._sum.amount ?? 0);

    let paymentStatus: PaymentStatus;
    if (refundedAmount > 0 && refundedAmount + 0.01 >= capturedAmount && capturedAmount > 0) {
      paymentStatus = PaymentStatus.REFUNDED;
    } else if (refundedAmount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
    } else if (capturedAmount + 0.01 >= order.total) {
      paymentStatus = PaymentStatus.PAID;
    } else if (capturedAmount > 0) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else if (pendingCount > 0) {
      paymentStatus = PaymentStatus.PENDING;
    } else if (failedCount > 0) {
      paymentStatus = PaymentStatus.FAILED;
    } else {
      paymentStatus = PaymentStatus.PENDING;
    }

    await client.order.update({ where: { id: orderId }, data: { paymentStatus } });
    return paymentStatus;
  }

  /** Applies a new status to a payment, logs it, and re-derives the order. */
  async transition(
    paymentId: string,
    next: PaymentStatus,
    event: Omit<PaymentEventInput, "fromStatus" | "toStatus">,
    extra: Prisma.PaymentUpdateInput = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          orderId: true,
          status: true,
          capturedAt: true
        }
      });
      if (!current) throw new NotFoundException("Payment not found.");

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: next,
          ...(next === PaymentStatus.PAID && !current.capturedAt ? { capturedAt: new Date() } : {}),
          ...extra
        }
      });

      await this.recordEvent(
        paymentId,
        { ...event, fromStatus: current.status, toStatus: next },
        tx
      );
      await this.reconcileOrderPaymentStatus(tx, current.orderId);
      return updated;
    });
  }

  /**
   * Records money taken outside any gateway — bank transfer, cash on
   * collection, a manual card terminal. Flagged `isManual` so offline money
   * stays visibly distinct from gateway money in every report.
   */
  async recordManualPayment(input: {
    orderId: string;
    amount: number;
    method: string;
    reference?: string;
    note?: string;
    actorId: string;
  }) {
    // Admins work from order numbers, so accept either that or the raw id.
    const reference = input.orderId.trim();
    const order = await this.prisma.order.findFirst({
      where: /^[a-f\d]{24}$/i.test(reference)
        ? { OR: [{ id: reference }, { orderNumber: reference }] }
        : { orderNumber: reference },
      select: { id: true, total: true, orderNumber: true }
    });
    if (!order) throw new NotFoundException("Order not found.");
    if (input.amount <= 0) throw new BadRequestException("Amount must be greater than zero.");

    const captured = await this.prisma.payment.aggregate({
      where: {
        orderId: order.id,
        status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] }
      },
      _sum: {
        amount: true,
        refundedAmount: true
      }
    });
    const paidAmount = Number(captured._sum.amount ?? 0);
    const refundedAmount = Number(captured._sum.refundedAmount ?? 0);
    const outstanding = Math.max(0, order.total - Math.max(0, paidAmount - refundedAmount));
    if (input.amount > outstanding + 0.01) {
      throw new BadRequestException(
        `That is more than the ${outstanding.toFixed(2)} still outstanding on this order.`
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "manual",
        method: input.method,
        amount: input.amount,
        status: PaymentStatus.PAID,
        transactionId: input.reference?.trim() || null,
        // Never null: the unique index on this column is not sparse in MongoDB,
        // so two key-less payments would collide. Manual capture has no natural
        // idempotency key, so a random one keeps the column unique and inert.
        idempotencyKey: `manual:${randomUUID()}`,
        isManual: true,
        recordedById: input.actorId,
        capturedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        action: "payment.manual_recorded",
        entity: "Payment",
        entityId: payment.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: input.amount,
          method: input.method,
          reference: input.reference?.trim() || null
        }
      }
    });

    await this.recordEvent(payment.id, {
      type: "captured",
      message: `Manual payment of ${input.amount.toFixed(2)} recorded via ${input.method}.`,
      toStatus: PaymentStatus.PAID,
      actorId: input.actorId,
      source: "admin",
      payload: { reference: input.reference, note: input.note }
    });

    await this.prisma.$transaction(async (tx) => {
      await this.reconcileOrderPaymentStatus(tx, order.id);
    });

    return payment;
  }

  /** Refundable balance for a payment, from the running total on the row. */
  refundableBalance(payment: { amount: number; refundedAmount: number }) {
    return Math.max(0, payment.amount - payment.refundedAmount);
  }

  /**
   * Whether the gateway behind this payment can move money programmatically.
   * Anything else has to be refunded out-of-band and recorded, and the caller
   * must say so rather than implying the system did it.
   */
  supportsGatewayRefund(provider: string) {
    return provider.toLowerCase() === "bkash";
  }

  /**
   * Issues a refund. For a supported gateway this actually calls the provider;
   * the refund is only marked COMPLETED when the provider confirms it. For any
   * other provider the caller must pass `manual`, which records the refund as
   * money moved elsewhere rather than pretending it was processed here.
   */
  async issueRefund(input: {
    paymentId: string;
    amount: number;
    reason: string;
    actorId: string;
    manual?: boolean;
    returnRequestId?: string;
  }) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        orderId: true,
        status: true,
        amount: true,
        refundedAmount: true,
        gatewayReference: true,
        transactionId: true,
        provider: true,
        order: { select: { id: true, orderNumber: true, email: true } }
      }
    });
    if (!payment) throw new NotFoundException("Payment not found.");
    if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException("Only a captured payment can be refunded.");
    }
    if (input.amount <= 0) throw new BadRequestException("Refund amount must be greater than zero.");

    const balance = this.refundableBalance(payment);
    if (input.amount > balance + 0.01) {
      throw new BadRequestException(
        `Refund exceeds the refundable balance of ${balance.toFixed(2)} on this payment.`
      );
    }

    const shouldCreateManualRefund = input.manual ?? !this.supportsGatewayRefund(payment.provider);
    const viaGateway = !shouldCreateManualRefund && this.supportsGatewayRefund(payment.provider);

    if (viaGateway && (!payment.gatewayReference || !payment.transactionId)) {
      throw new BadRequestException(
        "This payment has no gateway reference or transaction ID, so it cannot be refunded through the gateway yet."
      );
    }

    try {
      const refund = await this.prisma.refund.create({
        data: {
          orderId: payment.orderId,
          paymentId: payment.id,
          returnRequestId: input.returnRequestId,
          amount: input.amount,
          reason: input.reason,
          status: viaGateway ? RefundStatus.PROCESSING : RefundStatus.COMPLETED,
          isManual: shouldCreateManualRefund,
          requestedById: input.actorId,
          processedAt: viaGateway ? undefined : new Date()
        }
      });

      await this.prisma.auditLog.create({
        data: {
          action: viaGateway ? "refund.initiated" : "refund.recorded",
          entity: "Refund",
          entityId: refund.id,
          metadata: {
            orderId: payment.orderId,
            paymentId: payment.id,
            amount: input.amount,
            reason: input.reason,
            manual: shouldCreateManualRefund
          }
        }
      });

      await this.recordEvent(payment.id, {
        type: viaGateway ? "refund.requested" : "refund.recorded",
        message: viaGateway
          ? `Refund of ${input.amount.toFixed(2)} requested from ${payment.provider}.`
          : `Manual refund of ${input.amount.toFixed(2)} recorded (settled outside the gateway).`,
        actorId: input.actorId,
        source: "admin",
        payload: { refundId: refund.id, reason: input.reason }
      });

      if (!viaGateway) {
        await this.settleRefund(refund.id, { actorId: input.actorId });
        return this.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
      }

      const result = await this.bkash.refundPayment({
        paymentID: payment.gatewayReference ?? "",
        trxID: payment.transactionId ?? "",
        amount: input.amount,
        reason: input.reason,
        sku: payment.order.orderNumber
      });
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          gatewayReference: (result.refundTrxID ?? result.originalTrxID ?? null) as string | null,
          gatewayPayload: result as unknown as Prisma.InputJsonValue
        } as any
      });
      await this.settleRefund(refund.id, { actorId: input.actorId, gatewayPayload: result });
      return this.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "The refund could not be processed.";
      throw new BadRequestException(message);
    }
  }

  /**
   * Marks a refund complete and moves the money in our own records: the
   * payment's running refunded total, its status, and the order's status.
   */
  async settleRefund(refundId: string, meta: { actorId?: string; gatewayPayload?: unknown } = {}) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        select: {
          id: true,
          amount: true,
          processedAt: true,
          orderId: true,
          order: { select: { orderNumber: true, email: true } },
          payment: { select: { id: true, amount: true, refundedAmount: true, status: true } }
        }
      });
      if (!refund || !refund.payment) throw new NotFoundException("Refund not found.");

      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.COMPLETED,
          processedAt: refund.processedAt ?? new Date()
        }
      });

      const refundedAmount = refund.payment.refundedAmount + refund.amount;
      const fullyRefunded = refundedAmount + 0.01 >= refund.payment.amount;
      await tx.payment.update({
        where: { id: refund.payment.id },
        data: {
          refundedAmount,
          status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED
        }
      });

      await this.recordEvent(
        refund.payment.id,
        {
          type: "refund.completed",
          message: `Refund of ${refund.amount.toFixed(2)} settled.`,
          fromStatus: refund.payment.status,
          toStatus: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
          actorId: meta.actorId,
          source: meta.gatewayPayload ? "gateway" : "admin",
          payload: { refundId }
        },
        tx
      );

      await this.reconcileOrderPaymentStatus(tx, refund.orderId);

      await tx.notification.create({
        data: {
          orderId: refund.orderId,
          email: refund.order.email,
          title: "Refund processed",
          message: `Your refund of ${refund.amount.toFixed(2)} for ${refund.order.orderNumber} has been processed.`
        }
      });

      return updated;
    });
  }
}
