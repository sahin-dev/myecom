import { Injectable, Logger } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BkashService } from "./bkash.service";
import { PaymentsService } from "./payments.service";

export type ReconciliationRow = {
  paymentId: string;
  orderNumber: string;
  provider: string;
  amount: number;
  storedStatus: PaymentStatus;
  gatewayStatus: PaymentStatus | "UNKNOWN";
  outcome: "corrected" | "matched" | "unreachable";
  detail?: string;
};

const STALE_AFTER_MINUTES = 15;

/**
 * Sweeps payments the storefront left in PENDING and asks the gateway what
 * really happened.
 *
 * A customer who closes the tab mid-payment leaves a row that never resolves:
 * the money may have moved while the order still reads unpaid. Re-checking one
 * row at a time by hand does not scale, so this does it in bulk and reports
 * every divergence it corrected.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bkash: BkashService,
    private readonly payments: PaymentsService
  ) {}

  private statusFromBkash(payload: Record<string, unknown>): PaymentStatus | "UNKNOWN" {
    const value = String(
      payload.transactionStatus ?? payload.status ?? payload.statusMessage ?? ""
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
    if (value.includes("initiated") || value.includes("pending")) return PaymentStatus.PENDING;
    return "UNKNOWN";
  }

  async sweep(options: { staleMinutes?: number; actorId?: string } = {}) {
    const staleMinutes = options.staleMinutes ?? STALE_AFTER_MINUTES;
    const cutoff = new Date(Date.now() - staleMinutes * 60_000);

    const stale = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: cutoff },
        gatewayReference: { not: null },
        provider: "bkash"
      },
      include: { order: { select: { orderNumber: true, status: true } } },
      orderBy: { createdAt: "asc" },
      // Bounded so one sweep cannot hammer the gateway or run unboundedly long.
      take: 100
    });

    const rows: ReconciliationRow[] = [];

    for (const payment of stale) {
      const base = {
        paymentId: payment.id,
        orderNumber: payment.order.orderNumber,
        provider: payment.provider,
        amount: payment.amount,
        storedStatus: payment.status
      };

      let payload: Record<string, unknown>;
      try {
        payload = await this.bkash.queryPayment(payment.gatewayReference as string);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Gateway query failed.";
        this.logger.warn(`Reconciliation could not reach bKash for ${payment.id}: ${detail}`);
        rows.push({ ...base, gatewayStatus: "UNKNOWN", outcome: "unreachable", detail });
        continue;
      }

      const gatewayStatus = this.statusFromBkash(payload);
      if (gatewayStatus === "UNKNOWN" || gatewayStatus === payment.status) {
        rows.push({ ...base, gatewayStatus, outcome: "matched" });
        continue;
      }

      await this.payments.transition(
        payment.id,
        gatewayStatus,
        {
          type: "reconciled",
          message: `Reconciliation sweep corrected ${payment.status} to ${gatewayStatus} from the gateway.`,
          actorId: options.actorId,
          source: "system",
          payload
        },
        {
          transactionId:
            (payload.trxID as string | undefined) ?? payment.transactionId ?? undefined,
          providerPayload: payload as never,
          ...(gatewayStatus === PaymentStatus.FAILED
            ? { failureReason: String(payload.statusMessage ?? "Gateway reported failure.") }
            : {})
        }
      );

      rows.push({ ...base, gatewayStatus, outcome: "corrected" });
    }

    const corrected = rows.filter((row) => row.outcome === "corrected").length;
    if (corrected) {
      this.logger.log(`Reconciliation corrected ${corrected} of ${rows.length} stale payments.`);
    }

    return {
      checkedAt: new Date().toISOString(),
      staleMinutes,
      scanned: rows.length,
      corrected,
      unreachable: rows.filter((row) => row.outcome === "unreachable").length,
      rows
    };
  }
}
