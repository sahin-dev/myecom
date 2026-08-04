import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckoutMethodType, PaymentGatewayProvider, Prisma } from "@prisma/client";
import {
  CreateCheckoutMethodDto,
  CreatePaymentGatewayDto,
  UpdateCheckoutMethodDto,
  UpdatePaymentGatewayDto
} from "./ecommerce.dto";
import { PrismaService } from "../prisma/prisma.service";

const cleanCode = (value?: string | null) =>
  (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

type PaymentGatewayRecord = Prisma.PaymentGatewayGetPayload<{}>;

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutMethod(dto: CreateCheckoutMethodDto) {
    const paymentGatewayId = dto.type === CheckoutMethodType.PAYMENT ? dto.paymentGatewayId?.trim() || null : null;
    const method = await this.prisma.checkoutMethod.create({
      data: {
        ...dto,
        code: cleanCode(dto.code),
        fee: dto.fee ?? 0,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        translations: dto.translations as Prisma.InputJsonValue | undefined,
        paymentGatewayId,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      },
      include: { paymentGateway: true }
    });
    return {
      ...method,
      paymentGateway: method.paymentGateway ? this.maskPaymentGateway(method.paymentGateway) : null
    };
  }

  async updateCheckoutMethod(id: string, dto: UpdateCheckoutMethodDto) {
    const paymentGatewayId =
      dto.paymentGatewayId === undefined ? undefined : dto.paymentGatewayId.trim() || null;
    const method = await this.prisma.checkoutMethod.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? cleanCode(dto.code) : undefined,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        translations: dto.translations as Prisma.InputJsonValue | undefined,
        paymentGatewayId
      },
      include: { paymentGateway: true }
    });
    return {
      ...method,
      paymentGateway: method.paymentGateway ? this.maskPaymentGateway(method.paymentGateway) : null
    };
  }

  async deleteCheckoutMethod(id: string) {
    await this.prisma.deliveryRate.deleteMany({ where: { deliveryMethodId: id } });
    await this.prisma.checkoutMethod.delete({ where: { id } });
    return { deleted: true };
  }

  async createPaymentGateway(dto: CreatePaymentGatewayDto) {
    const name = dto.name.trim();
    const code = cleanCode(dto.code || name);
    if (!name || !code) throw new BadRequestException("Gateway name and code are required.");
    const created = await this.prisma.paymentGateway.create({
      data: {
        provider: dto.provider,
        name,
        code,
        description: dto.description?.trim() || null,
        mode: dto.mode?.trim() || "sandbox",
        apiBaseUrl: dto.apiBaseUrl?.trim() || null,
        appKey: dto.appKey?.trim() || null,
        appSecret: dto.appSecret?.trim() || null,
        username: dto.username?.trim() || null,
        password: dto.password?.trim() || null,
        callbackUrl: dto.callbackUrl?.trim() || null,
        webhookUrl: dto.webhookUrl?.trim() || null,
        merchantId: dto.merchantId?.trim() || null,
        storeId: dto.storeId?.trim() || null,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0
      },
      include: { _count: { select: { checkoutMethods: true } } }
    });
    return this.maskPaymentGateway(created);
  }

  async updatePaymentGateway(id: string, dto: UpdatePaymentGatewayDto) {
    const current = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Payment gateway not found.");
    const secretValue = (value: string | undefined) =>
      value === undefined ? undefined : value.trim() || undefined;
    const updated = await this.prisma.paymentGateway.update({
      where: { id },
      data: {
        provider: dto.provider,
        name: dto.name?.trim(),
        code: dto.code === undefined ? undefined : cleanCode(dto.code),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        mode: dto.mode === undefined ? undefined : dto.mode.trim() || "sandbox",
        apiBaseUrl: dto.apiBaseUrl === undefined ? undefined : dto.apiBaseUrl.trim() || null,
        appKey: secretValue(dto.appKey),
        appSecret: secretValue(dto.appSecret),
        username: secretValue(dto.username),
        password: secretValue(dto.password),
        callbackUrl: dto.callbackUrl === undefined ? undefined : dto.callbackUrl.trim() || null,
        webhookUrl: dto.webhookUrl === undefined ? undefined : dto.webhookUrl.trim() || null,
        merchantId: dto.merchantId === undefined ? undefined : dto.merchantId.trim() || null,
        storeId: dto.storeId === undefined ? undefined : dto.storeId.trim() || null,
        settings: dto.settings === undefined ? undefined : dto.settings as Prisma.InputJsonValue,
        isActive: dto.isActive,
        priority: dto.priority
      },
      include: { _count: { select: { checkoutMethods: true } } }
    });
    return this.maskPaymentGateway(updated);
  }

  async deletePaymentGateway(id: string) {
    const methods = await this.prisma.checkoutMethod.count({ where: { paymentGatewayId: id } });
    if (methods) {
      const archived = await this.prisma.paymentGateway.update({
        where: { id },
        data: { isActive: false },
        include: { _count: { select: { checkoutMethods: true } } }
      });
      return { archived: true, gateway: this.maskPaymentGateway(archived) };
    }
    await this.prisma.paymentGateway.delete({ where: { id } });
    return { deleted: true };
  }

  maskPaymentGateway<T extends PaymentGatewayRecord & { _count?: { checkoutMethods: number } }>(gateway: T) {
    const envConfigured =
      gateway.provider === PaymentGatewayProvider.BKASH &&
      Boolean(
        process.env.BKASH_APP_KEY &&
        process.env.BKASH_APP_SECRET &&
        process.env.BKASH_USERNAME &&
        process.env.BKASH_PASSWORD
      );
    return {
      ...gateway,
      appKey: gateway.appKey ? "configured" : null,
      appSecret: gateway.appSecret ? "configured" : null,
      username: gateway.username ? "configured" : null,
      password: gateway.password ? "configured" : null,
      credentialsConfigured: Boolean(
        gateway.appKey ||
        gateway.appSecret ||
        gateway.username ||
        gateway.password ||
        envConfigured
      ),
      envConfigured,
      apiConfigured: Boolean(gateway.apiBaseUrl || envConfigured)
    };
  }

  async ensureEnvBackedPaymentGateways() {
    const hasBkashEnv = Boolean(
      process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD
    );
    if (!hasBkashEnv) return;
    const existing = await this.prisma.paymentGateway.count({
      where: { provider: PaymentGatewayProvider.BKASH }
    });
    if (existing) return;
    const apiOrigin = process.env.API_PUBLIC_URL?.replace(/\/+$/, "") ?? "http://localhost:4000";
    const webOrigin = process.env.WEB_ORIGINS?.split(",")[0]?.trim() ?? "http://localhost:3000";
    await this.prisma.paymentGateway.create({
      data: {
        provider: PaymentGatewayProvider.BKASH,
        name: "bKash sandbox",
        code: "BKASH_SANDBOX",
        description: "Uses the bKash credentials configured in the API environment.",
        mode: "sandbox",
        apiBaseUrl: process.env.BKASH_BASE_URL ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
        callbackUrl: process.env.BKASH_CALLBACK_URL ?? `${webOrigin}/checkout/bkash/return`,
        webhookUrl: process.env.BKASH_WEBHOOK_URL ?? `${apiOrigin}/api/checkout/bkash/webhook`,
        isActive: true,
        priority: 0
      }
    });
  }
}
