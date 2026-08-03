import { BadRequestException, Injectable } from "@nestjs/common";
import { BkashService } from "./bkash.service";

const cleanCode = (value?: string | null) =>
  (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

type CheckoutPaymentInput = {
  orderNumber: string;
  amount: number;
};

type PaymentMethodDescriptor = {
  code?: string | null;
  name?: string | null;
  metadata?: unknown;
};

export type PreparedCheckoutPayment = {
  provider: string;
  gatewayPayment: Record<string, unknown> | null;
};

interface CheckoutPaymentStrategy {
  readonly provider: string;
  prepare(input: CheckoutPaymentInput): Promise<Record<string, unknown> | null>;
}

class CashPaymentStrategy implements CheckoutPaymentStrategy {
  readonly provider = "cash";

  async prepare() {
    return null;
  }
}

class BkashPaymentStrategy implements CheckoutPaymentStrategy {
  readonly provider = "bkash";

  constructor(private readonly bkash: BkashService) {}

  async prepare(input: CheckoutPaymentInput) {
    try {
      return await this.bkash.createPayment({
        orderNumber: input.orderNumber,
        amount: input.amount
      });
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? error.message
          : "This payment method could not be processed right now. Select another payment method or try again later.";
      throw new BadRequestException(message);
    }
  }
}

class UnsupportedOnlinePaymentStrategy implements CheckoutPaymentStrategy {
  constructor(readonly provider: string) {}

  async prepare(): Promise<Record<string, unknown> | null> {
    throw new BadRequestException(
      "This online payment method is not configured for checkout yet. Select another payment method."
    );
  }
}

@Injectable()
export class PaymentStrategyResolver {
  private readonly cashStrategy = new CashPaymentStrategy();
  private readonly strategies: Map<string, CheckoutPaymentStrategy>;

  constructor(private readonly bkash: BkashService) {
    const bkashStrategy = new BkashPaymentStrategy(this.bkash);
    this.strategies = new Map<string, CheckoutPaymentStrategy>([
      [this.cashStrategy.provider, this.cashStrategy],
      [bkashStrategy.provider, bkashStrategy]
    ]);
  }

  isCashPayment(code?: string | null, name?: string | null) {
    const value = `${cleanCode(code)} ${cleanCode(name)}`;
    return value.includes("COD") || value.includes("CASH_ON_DELIVERY") || value.includes("CASH");
  }

  providerFor(method: PaymentMethodDescriptor) {
    if (this.isCashPayment(method.code, method.name)) return "cash";
    const provider =
      method.metadata && typeof method.metadata === "object" && "provider" in method.metadata
        ? String((method.metadata as { provider?: unknown }).provider ?? "")
        : "";
    const value = `${cleanCode(method.code)} ${cleanCode(method.name)} ${cleanCode(provider)}`;
    if (value.includes("BKASH") || value.includes("ONLINE_PAYMENT")) return "bkash";
    if (value.includes("NAGAD")) return "nagad";
    if (value.includes("CARD")) return "card";
    return "pending-gateway";
  }

  async prepareForCheckout(input: {
    usesOnlinePayment: boolean;
    method: PaymentMethodDescriptor;
    orderNumber: string;
    amount: number;
  }): Promise<PreparedCheckoutPayment> {
    const provider = this.providerFor(input.method);
    if (!input.usesOnlinePayment) {
      return { provider, gatewayPayment: null };
    }
    const strategy = this.strategies.get(provider) ?? new UnsupportedOnlinePaymentStrategy(provider);
    const gatewayPayment = await strategy.prepare({
      orderNumber: input.orderNumber,
      amount: input.amount
    });
    return { provider, gatewayPayment };
  }
}
