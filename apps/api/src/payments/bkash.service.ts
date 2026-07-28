import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type BkashToken = {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type BkashCreateResponse = {
  paymentID: string;
  bkashURL: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
};

type BkashExecuteResponse = {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
};

/**
 * bKash Tokenized Checkout (PGW) integration.
 * Docs shape: grant token -> create payment -> customer redirected to bkashURL ->
 * bKash redirects back to the configured callback -> execute payment -> query payment (for reconciliation).
 * Requires BKASH_APP_KEY / BKASH_APP_SECRET / BKASH_USERNAME / BKASH_PASSWORD to be set;
 * without them every call fails fast with a clear configuration error rather than an obscure network error.
 */
@Injectable()
export class BkashService {
  private token: BkashToken | null = null;

  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const appKey = this.config.get<string>("BKASH_APP_KEY");
    const appSecret = this.config.get<string>("BKASH_APP_SECRET");
    const username = this.config.get<string>("BKASH_USERNAME");
    const password = this.config.get<string>("BKASH_PASSWORD");
    if (!appKey || !appSecret || !username || !password) {
      throw new BadRequestException(
        "bKash is not configured. Set BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, and BKASH_PASSWORD."
      );
    }
    return { appKey, appSecret, username, password };
  }

  private baseUrl() {
    return this.config.get<string>("BKASH_BASE_URL") ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  }

  private callbackUrl() {
    const configured = this.config.get<string>("BKASH_CALLBACK_URL");
    if (configured) return configured;
    const webOrigin = this.config.get<string>("WEB_ORIGINS")?.split(",")[0]?.trim() ?? "http://localhost:3000";
    return `${webOrigin}/checkout/bkash/return`;
  }

  private async grantToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.idToken;
    }
    const { appKey, appSecret, username, password } = this.credentials();
    const response = await fetch(`${this.baseUrl()}/tokenized/checkout/token/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        username,
        password
      },
      body: JSON.stringify({ app_key: appKey, app_secret: appSecret })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id_token) {
      throw new InternalServerErrorException(data.msg ?? "Could not authenticate with bKash.");
    }
    this.token = {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000
    };
    return this.token.idToken;
  }

  private async authorizedPost<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T }> {
    const idToken = await this.grantToken();
    const { appKey } = this.credentials();
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: idToken,
        "X-App-Key": appKey
      },
      body: JSON.stringify(body)
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, data };
  }

  async createPayment(params: { orderNumber: string; amount: number }): Promise<BkashCreateResponse> {
    const { ok, data } = await this.authorizedPost<BkashCreateResponse>("/tokenized/checkout/create", {
      mode: "0011",
      payerReference: params.orderNumber,
      callbackURL: this.callbackUrl(),
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.orderNumber
    });
    if (!ok || !data.paymentID || !data.bkashURL) {
      throw new InternalServerErrorException(data.statusMessage ?? "Could not create the bKash payment.");
    }
    return data;
  }

  async executePayment(paymentID: string): Promise<BkashExecuteResponse> {
    const { ok, data } = await this.authorizedPost<BkashExecuteResponse>("/tokenized/checkout/execute", {
      paymentID
    });
    if (!ok || data.transactionStatus !== "Completed") {
      throw new BadRequestException(data.statusMessage ?? "The bKash payment could not be completed.");
    }
    return data;
  }

  async queryPayment(paymentID: string) {
    const { ok, data } = await this.authorizedPost<Record<string, unknown>>(
      "/tokenized/checkout/payment/status",
      { paymentID }
    );
    if (!ok) {
      throw new InternalServerErrorException(
        (data.statusMessage as string | undefined) ?? "Could not query the bKash payment."
      );
    }
    return data;
  }
}
