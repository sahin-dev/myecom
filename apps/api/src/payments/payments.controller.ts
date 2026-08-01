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
import { ExecuteBkashDto, InitiateBkashDto } from "./payments.dto";

@Controller("checkout/bkash")
export class PaymentsController {
  constructor(
    private readonly bkash: BkashService,
    private readonly prisma: PrismaService,
    private readonly ecommerce: EcommerceService
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
    } catch (error) {
      await this.markPaymentFailed(dto.paymentID);
      throw error;
    }

    
    return this.confirmPaidOnlineOrder(payment.orderId);
  }

  @Post("failed")
  async failed(@Body() dto: ExecuteBkashDto) {
    return this.markPaymentFailed(dto.paymentID);
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
