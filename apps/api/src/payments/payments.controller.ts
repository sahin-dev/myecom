import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { OptionalJwtAuthGuard } from "../auth/auth.guards";
import type { OptionalAuthenticatedRequest } from "../auth/auth.types";
import { EcommerceService } from "../ecommerce/ecommerce.service";
import { PrismaService } from "../prisma/prisma.service";
import { BkashService } from "./bkash.service";
import { PaymentRateLimitGuard } from "./payment-rate-limit.guard";
import { PaymentsService } from "./payments.service";
import { ExecuteBkashDto, InitiateBkashDto } from "./payments.dto";

@Controller("checkout/bkash")
export class PaymentsController {
  constructor(
    private readonly bkash: BkashService,
    private readonly prisma: PrismaService,
    private readonly ecommerce: EcommerceService,
    private readonly payments: PaymentsService
  ) {}

  @Post("initiate")
  @UseGuards(OptionalJwtAuthGuard)
  async initiate(@Body() dto: InitiateBkashDto, @Req() request: OptionalAuthenticatedRequest) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { payments: true }
    });
    if (!order) throw new NotFoundException("Order not found.");
    if (request.user && order.userId && order.userId !== request.user.id) {
      throw new BadRequestException("This order does not belong to your account.");
    }
    const payment = order.payments.find(
      (item) => item.provider === "bkash" && item.status === "PENDING"
    );
    if (!payment) {
      throw new BadRequestException("This order has no pending bKash payment to initiate.");
    }
    const existingPayload =
      payment.providerPayload &&
      typeof payment.providerPayload === "object" &&
      !Array.isArray(payment.providerPayload)
        ? payment.providerPayload as Record<string, unknown>
        : {};
    if (payment.gatewayReference && typeof existingPayload.bkashURL === "string") {
      return { bkashURL: existingPayload.bkashURL, paymentID: payment.gatewayReference };
    }

    const created = await this.bkash.createPayment({
      orderNumber: order.orderNumber,
      amount: payment.amount
    }).catch(async (error) => {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED }
        });
        await this.reconcileOrderPaymentStatus(transaction, order.id);
      });
      await this.auditPaymentTransition(payment.id, "payment.initiation.failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
      await this.cancelFailedOnlineOrder(order.id);
      throw error;
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayReference: created.paymentID,
        providerPayload: created as unknown as Prisma.InputJsonValue
      }
    });

    return { bkashURL: created.bkashURL, paymentID: created.paymentID };
  }

  @Post("execute")
  @UseGuards(PaymentRateLimitGuard)
  async execute(@Body() dto: ExecuteBkashDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayReference: dto.paymentID },
      include: { order: true }
    });
    if (!payment) throw new NotFoundException("Payment not found for this bKash payment ID.");

    if (payment.status === PaymentStatus.PAID) {
      return this.confirmPaidOnlineOrder(payment.orderId);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("This bKash payment attempt is no longer pending.");
    }

    try {
      const result = await this.bkash.executePayment(dto.paymentID);
      await this.prisma.$transaction(async (transaction) => {
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            transactionId: result.trxID,
            providerPayload: result as unknown as Prisma.InputJsonValue
          }
        });
        await this.reconcileOrderPaymentStatus(transaction, payment.orderId);
      });
      await this.auditPaymentTransition(payment.id, "payment.captured.gateway", {
        orderId: payment.orderId,
        transactionId: result.trxID
      });
    } catch (error) {
      return this.applyVerifiedBkashStatus(dto.paymentID);
    }

    
    return this.confirmPaidOnlineOrder(payment.orderId);
  }

  @Post("failed")
  @UseGuards(PaymentRateLimitGuard)
  async failed(@Body() dto: ExecuteBkashDto) {
    return this.markPaymentFailed(dto.paymentID);
  }

  @Post("webhook")
  @UseGuards(PaymentRateLimitGuard)
  async webhook(@Body() payload: Record<string, unknown>) {
    const paymentID = this.paymentIdFromPayload(payload);
    if (!paymentID) throw new BadRequestException("bKash webhook did not include a paymentID.");
    return this.applyVerifiedBkashStatus(paymentID);
  }

  @Post("ipn")
  async ipn(@Body() payload: Record<string, unknown>) {
    return this.webhook(payload);
  }

  private async auditPaymentTransition(paymentId: string, action: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity: "Payment",
        entityId: paymentId,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private paymentIdFromPayload(payload: Record<string, unknown>) {
    return String(
      payload.paymentID ??
      payload.paymentId ??
      payload.payment_id ??
      payload.PaymentID ??
      ""
    ).trim();
  }

  private bkashPaymentStatus(payload: Record<string, unknown>) {
    const value = String(
      payload.transactionStatus ??
      payload.status ??
      payload.paymentStatus ??
      payload.statusMessage ??
      ""
    ).toLowerCase();
    if (value.includes("completed") || value.includes("success")) return PaymentStatus.PAID;
    if (
      value.includes("fail") ||
      value.includes("cancel") ||
      value.includes("declin") ||
      value.includes("expired")
    ) {
      return PaymentStatus.FAILED;
    }
    return PaymentStatus.PENDING;
  }

  private async applyVerifiedBkashStatus(paymentID: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayReference: paymentID },
      include: { order: true }
    });
    if (!payment) throw new NotFoundException("Payment not found for this bKash payment ID.");
    if (payment.status === PaymentStatus.PAID) {
      return this.confirmPaidOnlineOrder(payment.orderId);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return this.prisma.order.findUnique({
        where: { id: payment.orderId },
        include: {
          items: true,
          payments: true,
          trackingEvents: { orderBy: { createdAt: "asc" } }
        }
      });
    }
    const result = await this.bkash.queryPayment(paymentID);
    const status = this.bkashPaymentStatus(result);
    if (status === PaymentStatus.PAID) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            transactionId: String(result.trxID ?? result.transactionId ?? payment.transactionId ?? "") || null,
            providerPayload: result as unknown as Prisma.InputJsonValue
          }
        });
        await this.reconcileOrderPaymentStatus(transaction, payment.orderId);
      });
      await this.auditPaymentTransition(payment.id, "payment.captured.gateway", {
        orderId: payment.orderId,
        source: "webhook"
      });
      return this.confirmPaidOnlineOrder(payment.orderId);
    }
    if (status === PaymentStatus.FAILED) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            providerPayload: result as unknown as Prisma.InputJsonValue
          }
        });
        await this.reconcileOrderPaymentStatus(transaction, payment.orderId);
      });
      await this.auditPaymentTransition(payment.id, "payment.failed.gateway", {
        orderId: payment.orderId,
        source: "webhook"
      });
      return this.cancelFailedOnlineOrder(payment.orderId);
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPayload: result as unknown as Prisma.InputJsonValue }
    });
    return this.prisma.order.findUnique({
      where: { id: payment.orderId },
      include: {
        items: true,
        payments: true,
        trackingEvents: { orderBy: { createdAt: "asc" } }
      }
    });
  }

  private async markPaymentFailed(paymentID: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayReference: paymentID },
      include: { order: true }
    });
    if (!payment) throw new NotFoundException("Payment not found for this bKash payment ID.");
    if (payment.status === PaymentStatus.PAID) {
      return this.prisma.order.findUnique({
        where: { id: payment.orderId },
        include: {
          items: true,
          payments: true,
          trackingEvents: { orderBy: { createdAt: "asc" } }
        }
      });
    }
    if (payment.status === PaymentStatus.FAILED) {
      await this.prisma.$transaction(async (transaction) => {
        await this.reconcileOrderPaymentStatus(transaction, payment.orderId);
      });
      return this.cancelFailedOnlineOrder(payment.orderId);
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED }
      });
      await this.reconcileOrderPaymentStatus(transaction, payment.orderId);
    });
    await this.auditPaymentTransition(payment.id, "payment.failed.gateway", {
      orderId: payment.orderId,
      source: "manual"
    });
    return this.cancelFailedOnlineOrder(payment.orderId);
  }

  private cancelFailedOnlineOrder(orderId: string) {
    return this.ecommerce.updateOrderStatus(orderId, {
      status: "CANCELLED",
      location: "Payment gateway",
      note: "Online payment failed or was cancelled before completion."
    }, true);
  }

  private async confirmPaidOnlineOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true }
    });
    if (!order) throw new NotFoundException("Order not found.");
    if (order.status === OrderStatus.PLACED) {
      return this.ecommerce.updateOrderStatus(orderId, {
        status: OrderStatus.CONFIRMED,
        location: "Payment gateway",
        note: "Online payment completed and the order was confirmed automatically."
      });
    }
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        trackingEvents: { orderBy: { createdAt: "asc" } }
      }
    });
  }

  private async reconcileOrderPaymentStatus(
    transaction: Prisma.TransactionClient,
    orderId: string
  ) {
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      select: { total: true }
    });
    if (!order) throw new NotFoundException("Order not found.");

    const [paid, pendingCount, failedCount] = await Promise.all([
      transaction.payment.aggregate({
        where: { orderId, status: PaymentStatus.PAID },
        _sum: { amount: true }
      }),
      transaction.payment.count({ where: { orderId, status: PaymentStatus.PENDING } }),
      transaction.payment.count({ where: { orderId, status: PaymentStatus.FAILED } })
    ]);
    const paidAmount = Number(paid._sum.amount ?? 0);
    const paymentStatus =
      paidAmount + 0.01 >= order.total
        ? PaymentStatus.PAID
        : paidAmount > 0
          ? PaymentStatus.PARTIALLY_PAID
          : pendingCount > 0
            ? PaymentStatus.PENDING
            : failedCount > 0
              ? PaymentStatus.FAILED
              : PaymentStatus.PENDING;

    await transaction.order.update({
      where: { id: orderId },
      data: { paymentStatus }
    });
  }
}
