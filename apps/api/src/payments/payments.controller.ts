import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { PaymentStatus, Prisma } from "@prisma/client";
import { OptionalJwtAuthGuard } from "../auth/auth.guards";
import type { OptionalAuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { BkashService } from "./bkash.service";
import { ExecuteBkashDto, InitiateBkashDto } from "./payments.dto";

@Controller("checkout/bkash")
export class PaymentsController {
  constructor(
    private readonly bkash: BkashService,
    private readonly prisma: PrismaService
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

    if (payment.status === "PAID") {
      return this.prisma.order.findUnique({
        where: { id: payment.orderId },
        include: {
          items: true,
          payments: true,
          trackingEvents: { orderBy: { createdAt: "asc" } }
        }
      });
    }

    try {
      const result = await this.bkash.executePayment(dto.paymentID);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          transactionId: result.trxID,
          providerPayload: result as unknown as Prisma.InputJsonValue
        }
      });
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus:
            payment.amount + 0.01 >= payment.order.total
              ? PaymentStatus.PAID
              : PaymentStatus.PARTIALLY_PAID
        }
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" }
      });
      throw error;
    }

    return this.prisma.order.findUnique({
      where: { id: payment.orderId },
      include: {
        items: true,
        payments: true,
        trackingEvents: { orderBy: { createdAt: "asc" } }
      }
    });
  }
}
