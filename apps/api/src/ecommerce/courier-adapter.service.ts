import { BadRequestException, Injectable } from "@nestjs/common";
import { CourierProvider, CourierShipmentStatus, Prisma } from "@prisma/client";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

type CourierServiceRecord = Prisma.CourierServiceGetPayload<{}>;

type CourierShipmentReference = Pick<
  Prisma.CourierShipmentGetPayload<{}>,
  "trackingCode" | "providerOrderId" | "consignmentId"
>;

export type CourierReferenceFallback = {
  trackingCode?: string;
  providerOrderId?: string;
  consignmentId?: string;
};

interface CourierProviderAdapter {
  createShipment(
    service: CourierServiceRecord,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  getShipmentStatus(
    service: CourierServiceRecord,
    shipment: CourierShipmentReference
  ): Promise<Record<string, unknown>>;
}

class ManualCourierAdapter implements CourierProviderAdapter {
  async createShipment(_service: CourierServiceRecord, _payload: Record<string, unknown>) {
    return { mode: "manual", status: "created", message: "Manual courier shipment created." };
  }

  async getShipmentStatus(_service: CourierServiceRecord, shipment: CourierShipmentReference) {
    return {
      mode: "manual",
      status: shipment.trackingCode ? "created" : "unknown",
      message: "No courier status endpoint is configured."
    };
  }
}

class HttpCourierAdapter implements CourierProviderAdapter {
  async createShipment(service: CourierServiceRecord, payload: Record<string, unknown>) {
    const settings = asRecord(service.settings);
    const baseUrl = service.apiBaseUrl?.trim();
    if (!baseUrl) return new ManualCourierAdapter().createShipment(service, payload);
    const path = String(settings.dispatchPath ?? settings.createOrderPath ?? "").trim();
    const endpoint = `${baseUrl.replace(/\/+$/, "")}${path ? `/${path.replace(/^\/+/, "")}` : ""}`;
    const response = await fetch(endpoint, {
      method: String(settings.dispatchMethod ?? "POST"),
      headers: this.headers(service),
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(body.message ?? body.error ?? `Courier API rejected the parcel request (${response.status}).`)
      );
    }
    return body;
  }

  async getShipmentStatus(service: CourierServiceRecord, shipment: CourierShipmentReference) {
    const settings = asRecord(service.settings);
    const baseUrl = service.apiBaseUrl?.trim();
    const pathTemplate = String(settings.statusPath ?? settings.syncPath ?? "").trim();
    if (!baseUrl || !pathTemplate) {
      return new ManualCourierAdapter().getShipmentStatus(service, shipment);
    }
    const path = pathTemplate
      .replace(/:trackingCode/g, encodeURIComponent(shipment.trackingCode ?? ""))
      .replace(/:providerOrderId/g, encodeURIComponent(shipment.providerOrderId ?? ""))
      .replace(/:consignmentId/g, encodeURIComponent(shipment.consignmentId ?? ""));
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    const response = await fetch(endpoint, {
      method: String(settings.statusMethod ?? "GET"),
      headers: this.headers(service)
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(body.message ?? body.error ?? `Courier status check failed (${response.status}).`)
      );
    }
    return body;
  }

  private headers(service: CourierServiceRecord) {
    const settings = asRecord(service.settings);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (service.apiKey) {
      headers.Authorization = `Bearer ${service.apiKey}`;
      headers["Api-Key"] = service.apiKey;
      headers["X-API-Key"] = service.apiKey;
    }
    if (service.apiSecret) {
      headers["Secret-Key"] = service.apiSecret;
      headers["X-API-Secret"] = service.apiSecret;
    }
    if (service.clientId) headers["X-Client-Id"] = service.clientId;
    for (const [key, value] of Object.entries(asRecord(settings.headers))) {
      if (typeof value === "string" && value.trim()) headers[key] = value;
    }
    return headers;
  }
}

@Injectable()
export class CourierAdapterResolver {
  private readonly manual = new ManualCourierAdapter();
  private readonly http = new HttpCourierAdapter();

  for(service: CourierServiceRecord): CourierProviderAdapter {
    if (service.provider === CourierProvider.MANUAL) return this.manual;
    return this.http;
  }

  supportsStatusSync(service: CourierServiceRecord) {
    if (service.provider === CourierProvider.MANUAL) return false;
    const settings = asRecord(service.settings);
    return Boolean(
      service.apiBaseUrl?.trim() &&
      String(settings.statusPath ?? settings.syncPath ?? "").trim()
    );
  }

  extractReferences(
    response: Record<string, unknown>,
    fallback: CourierReferenceFallback
  ) {
    const data = asRecord(response.data);
    const consignment = asRecord(data.consignment) || asRecord(response.consignment);
    const get = (...keys: string[]) => keys
      .map((key) => response[key] ?? data[key] ?? consignment[key])
      .find((value) => value !== undefined && value !== null && String(value).trim());
    return {
      trackingCode: String(get("trackingCode", "tracking_code", "tracking_id", "waybill", "cn_number") ?? fallback.trackingCode ?? "").trim() || null,
      providerOrderId: String(get("providerOrderId", "provider_order_id", "order_id", "invoice") ?? fallback.providerOrderId ?? "").trim() || null,
      consignmentId: String(get("consignmentId", "consignment_id") ?? fallback.consignmentId ?? "").trim() || null
    };
  }

  normalizeStatus(value: unknown): CourierShipmentStatus {
    const normalized = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    if (["DELIVERED", "COMPLETED", "DELIVERY_COMPLETED"].includes(normalized)) return CourierShipmentStatus.DELIVERED;
    if (["FAILED", "DELIVERY_FAILED", "FAILED_DELIVERY", "UNDELIVERED"].includes(normalized)) return CourierShipmentStatus.DELIVERY_FAILED;
    if (["OUT_FOR_DELIVERY", "ON_THE_WAY"].includes(normalized)) return CourierShipmentStatus.OUT_FOR_DELIVERY;
    if (["PICKED_UP", "PICKED"].includes(normalized)) return CourierShipmentStatus.PICKED_UP;
    if (["IN_TRANSIT", "TRANSIT", "ON_TRANSIT"].includes(normalized)) return CourierShipmentStatus.IN_TRANSIT;
    if (["RETURNED", "RETURN_TO_MERCHANT", "RETURNED_TO_SELLER"].includes(normalized)) return CourierShipmentStatus.RETURNED;
    if (["CANCELLED", "CANCELED"].includes(normalized)) return CourierShipmentStatus.CANCELLED;
    if (["PICKUP_REQUESTED", "REQUESTED"].includes(normalized)) return CourierShipmentStatus.PICKUP_REQUESTED;
    if (["CREATED", "PENDING", "ACCEPTED"].includes(normalized)) return CourierShipmentStatus.CREATED;
    return CourierShipmentStatus.UNKNOWN;
  }

  defaultMessage(status: CourierShipmentStatus) {
    if (status === CourierShipmentStatus.DELIVERY_FAILED) return "Delivery attempt failed.";
    return `Parcel status updated to ${status.toLowerCase().replace(/_/g, " ")}.`;
  }

  deliveryFailedReasonFrom(response: Record<string, unknown>) {
    const data = asRecord(response.data);
    return String(
      response.deliveryFailedReason ??
      response.failure_reason ??
      response.failed_reason ??
      response.reason ??
      data.deliveryFailedReason ??
      data.failure_reason ??
      data.reason ??
      ""
    ).trim() || undefined;
  }

  paymentCollectionFrom(response: Record<string, unknown>) {
    const data = asRecord(response.data);
    const rawAmount =
      response.collectedAmount ??
      response.collected_amount ??
      response.amount_collected ??
      response.codAmountCollected ??
      response.cod_amount_collected ??
      data.collectedAmount ??
      data.collected_amount ??
      data.amount_collected;
    const amount = Number(rawAmount);
    const rawCollected =
      response.paymentCollected ??
      response.payment_collected ??
      response.codCollected ??
      response.cod_collected ??
      data.paymentCollected ??
      data.payment_collected ??
      data.cod_collected;
    const collected =
      [true, 1, "1", "true", "paid", "collected", "complete", "completed"].includes(
        typeof rawCollected === "string" ? rawCollected.toLowerCase() : rawCollected as never
      ) || (Number.isFinite(amount) && amount > 0);
    return {
      collected,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined
    };
  }
}
