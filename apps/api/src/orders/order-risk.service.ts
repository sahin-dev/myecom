import { Injectable } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type RiskAssessment = { score: number; flags: string[] };

/** Above this, the order lands in the review queue. */
export const RISK_REVIEW_THRESHOLD = 40;

const RULES = {
  /** An order this size from someone who has never bought before. */
  highValueFirstOrder: { points: 25, threshold: 15000 },
  /** Unpaid at placement and worth a lot — the classic cash-on-delivery loss. */
  highValueUnpaid: { points: 30, threshold: 10000 },
  /** Same email placing another order within this window. */
  rapidRepeat: { points: 20, windowMinutes: 30 },
  /** This customer's history of refusing delivery. */
  priorFailedDeliveries: { points: 25, threshold: 2 },
  /** Address too short to actually deliver to. */
  thinAddress: { points: 15, minLength: 20 },
  /** Phone number that cannot be a Bangladeshi mobile. */
  suspiciousPhone: { points: 15 }
} as const;

/**
 * Scores an order for the risks that actually cost money in a
 * cash-on-delivery market: refused parcels, duplicate orders, and addresses
 * nobody can deliver to.
 *
 * Advisory only. Nothing is ever blocked automatically — the score puts an
 * order in front of a human, who decides.
 */
@Injectable()
export class OrderRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(orderId: string): Promise<RiskAssessment> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        phone: true,
        total: true,
        userId: true,
        shippingAddress: true,
        paymentStatus: true,
        createdAt: true
      }
    });
    if (!order) return { score: 0, flags: [] };

    const flags: string[] = [];
    let score = 0;

    const [priorOrders, recentSameEmail, failedDeliveries] = await Promise.all([
      this.prisma.order.count({
        where: { email: order.email, id: { not: order.id }, status: { not: OrderStatus.CANCELLED } }
      }),
      this.prisma.order.count({
        where: {
          email: order.email,
          id: { not: order.id },
          createdAt: {
            gte: new Date(order.createdAt.getTime() - RULES.rapidRepeat.windowMinutes * 60_000)
          }
        }
      }),
      this.prisma.order.count({
        where: {
          email: order.email,
          id: { not: order.id },
          status: { in: [OrderStatus.DELIVERY_FAILED, OrderStatus.RETURNED_TO_ORIGIN] }
        }
      })
    ]);

    const unpaid =
      order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED;

    if (priorOrders === 0 && order.total >= RULES.highValueFirstOrder.threshold) {
      score += RULES.highValueFirstOrder.points;
      flags.push("First order, high value");
    }
    if (unpaid && order.total >= RULES.highValueUnpaid.threshold) {
      score += RULES.highValueUnpaid.points;
      flags.push("High-value order with nothing paid up front");
    }
    if (recentSameEmail > 0) {
      score += RULES.rapidRepeat.points;
      flags.push(
        `${recentSameEmail} other order${recentSameEmail === 1 ? "" : "s"} from this email in the last ${RULES.rapidRepeat.windowMinutes} minutes`
      );
    }
    if (failedDeliveries >= RULES.priorFailedDeliveries.threshold) {
      score += RULES.priorFailedDeliveries.points;
      flags.push(`${failedDeliveries} previous deliveries to this customer failed`);
    }
    if ((order.shippingAddress?.trim().length ?? 0) < RULES.thinAddress.minLength) {
      score += RULES.thinAddress.points;
      flags.push("Shipping address looks too short to deliver to");
    }
    // Bangladeshi mobiles are 01X followed by 8 digits, optionally +880-prefixed.
    const digits = order.phone?.replace(/\D/g, "") ?? "";
    const normalized = digits.startsWith("880") ? digits.slice(3) : digits;
    if (!/^01[3-9]\d{8}$/.test(normalized)) {
      score += RULES.suspiciousPhone.points;
      flags.push("Phone number is not a valid mobile number");
    }

    return { score: Math.min(100, score), flags };
  }

  /** Assesses and stores the result. Never throws — risk is advisory. */
  async assessAndStore(orderId: string) {
    try {
      const { score, flags } = await this.assess(orderId);
      await this.prisma.order.update({
        where: { id: orderId },
        data: { riskScore: score, riskFlags: flags }
      });
      return { score, flags };
    } catch {
      return { score: 0, flags: [] as string[] };
    }
  }

  async markReviewed(orderId: string, actorId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { riskReviewedAt: new Date(), riskReviewedById: actorId }
    });
  }
}
