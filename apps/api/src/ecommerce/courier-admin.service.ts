import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CourierProvider,
  CourierShipmentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import {
  CreateCourierServiceDto,
  DispatchCourierShipmentDto,
  UpdateCourierServiceDto,
  UpdateCourierShipmentDto
} from "./ecommerce.dto";
import { CourierAdapterResolver } from "./courier-adapter.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";

const cleanCode = (value?: string | null) =>
  (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const roundMoney = (value: number) => Number(value.toFixed(2));

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const formatAddressInfo = (info?: {
  recipient?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  area?: string;
  city?: string;
  postalCode?: string;
}) =>
  [
    info?.recipient,
    info?.phone,
    info?.line1,
    info?.line2,
    info?.area,
    info?.city,
    info?.postalCode
  ].map((part) => part?.trim()).filter(Boolean).join(", ");

const shipmentToOrderStatus: Partial<Record<CourierShipmentStatus, OrderStatus>> = {
  CREATED: OrderStatus.SHIPPED,
  PICKUP_REQUESTED: OrderStatus.SHIPPED,
  PICKED_UP: OrderStatus.SHIPPED,
  IN_TRANSIT: OrderStatus.SHIPPED,
  OUT_FOR_DELIVERY: OrderStatus.OUT_FOR_DELIVERY,
  DELIVERED: OrderStatus.DELIVERED,
  DELIVERY_FAILED: OrderStatus.DELIVERY_FAILED
};

const courierDispatchableOrderStatuses: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERY_FAILED
];

const courierTerminalStatuses: CourierShipmentStatus[] = [
  CourierShipmentStatus.DELIVERED,
  CourierShipmentStatus.RETURNED,
  CourierShipmentStatus.CANCELLED
];

const paidPaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED
];

type CourierServiceRecord = Prisma.CourierServiceGetPayload<{}>;
type CourierDispatchOrder = Prisma.OrderGetPayload<{
  include: { items: true; payments: true; courierShipments: true };
}>;

@Injectable()
export class CourierAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierAdapters: CourierAdapterResolver,
    private readonly payments: PaymentsService
  ) {}

  async adminCourierServices() {
    const services = await this.prisma.courierService.findMany({
      include: { _count: { select: { shipments: true } } },
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    });
    return services.map((service) => this.maskCourierService(service));
  }

  async createCourierService(dto: CreateCourierServiceDto) {
    const name = dto.name.trim();
    const code = cleanCode(dto.code || name);
    if (!name || !code) throw new BadRequestException("Courier name and code are required.");
    const created = await this.prisma.courierService.create({
      data: {
        provider: dto.provider,
        name,
        code,
        description: dto.description?.trim() || null,
        apiBaseUrl: dto.apiBaseUrl?.trim() || null,
        apiKey: dto.apiKey?.trim() || null,
        apiSecret: dto.apiSecret?.trim() || null,
        clientId: dto.clientId?.trim() || null,
        clientSecret: dto.clientSecret?.trim() || null,
        storeId: dto.storeId?.trim() || null,
        defaultPickupAddress: dto.defaultPickupAddress?.trim() || null,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0
      },
      include: { _count: { select: { shipments: true } } }
    });
    return this.maskCourierService(created);
  }

  async updateCourierService(id: string, dto: UpdateCourierServiceDto) {
    const current = await this.prisma.courierService.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Courier service not found.");
    const updated = await this.prisma.courierService.update({
      where: { id },
      data: {
        provider: dto.provider,
        name: dto.name?.trim(),
        code: dto.code === undefined ? undefined : cleanCode(dto.code),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        apiBaseUrl: dto.apiBaseUrl === undefined ? undefined : dto.apiBaseUrl.trim() || null,
        apiKey: dto.apiKey === undefined ? undefined : dto.apiKey.trim() || null,
        apiSecret: dto.apiSecret === undefined ? undefined : dto.apiSecret.trim() || null,
        clientId: dto.clientId === undefined ? undefined : dto.clientId.trim() || null,
        clientSecret: dto.clientSecret === undefined ? undefined : dto.clientSecret.trim() || null,
        storeId: dto.storeId === undefined ? undefined : dto.storeId.trim() || null,
        defaultPickupAddress:
          dto.defaultPickupAddress === undefined ? undefined : dto.defaultPickupAddress.trim() || null,
        settings: dto.settings === undefined ? undefined : dto.settings as Prisma.InputJsonValue,
        isActive: dto.isActive,
        priority: dto.priority
      },
      include: { _count: { select: { shipments: true } } }
    });
    return this.maskCourierService(updated);
  }

  async deleteCourierService(id: string) {
    const shipments = await this.prisma.courierShipment.count({ where: { courierServiceId: id } });
    if (shipments) {
      const archived = await this.prisma.courierService.update({
        where: { id },
        data: { isActive: false },
        include: { _count: { select: { shipments: true } } }
      });
      return { archived: true, service: this.maskCourierService(archived) };
    }
    await this.prisma.courierService.delete({ where: { id } });
    return { deleted: true };
  }

  async dispatchCourierShipment(
    idOrNumber: string,
    dto: DispatchCourierShipmentDto,
    actorId: string
  ) {
    const order = await this.findOrderForCourier(idOrNumber);
    if (!courierDispatchableOrderStatuses.includes(order.status)) {
      throw new BadRequestException("Confirm the order before dispatching a courier parcel.");
    }
    const activeShipment = order.courierShipments.find((shipment) =>
      !courierTerminalStatuses.includes(shipment.status)
    );
    if (activeShipment) {
      throw new BadRequestException("This order already has an active courier shipment.");
    }
    const service = await this.prisma.courierService.findUnique({
      where: { id: dto.courierServiceId }
    });
    if (!service || !service.isActive) {
      throw new BadRequestException("Choose an active courier service.");
    }
    const payload = this.buildCourierDispatchPayload(order, service, dto);
    const response = await this.courierAdapters.for(service).createShipment(service, payload);
    const extracted = this.courierAdapters.extractReferences(response, dto);
    const trackingCode = extracted.trackingCode || dto.trackingCode?.trim() || null;
    const message =
      response.mode === "manual"
        ? "Courier shipment prepared for manual dispatch."
        : "Courier shipment request was sent to the provider.";

    await this.prisma.$transaction(async (transaction) => {
      await transaction.courierShipment.create({
        data: {
          orderId: order.id,
          courierServiceId: service.id,
          provider: service.provider,
          status: CourierShipmentStatus.CREATED,
          cashCollectionAmount: Number(payload.codAmount ?? 0),
          trackingCode,
          providerOrderId: extracted.providerOrderId || dto.providerOrderId?.trim() || null,
          consignmentId: extracted.consignmentId || dto.consignmentId?.trim() || null,
          dispatchPayload: payload as Prisma.InputJsonValue,
          providerResponse: response as Prisma.InputJsonValue,
          lastSyncedAt: response.mode === "manual" ? null : new Date(),
          events: {
            create: {
              normalizedStatus: CourierShipmentStatus.CREATED,
              providerStatus: String(response.status ?? response.providerStatus ?? "created"),
              message,
              location: service.name,
              rawPayload: response as Prisma.InputJsonValue
            }
          }
        }
      });
      await transaction.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SHIPPED,
          courierName: service.name,
          trackingCode,
          trackingEvents: {
            create: {
              status: OrderStatus.SHIPPED,
              location: service.name,
              note: trackingCode
                ? `${message} Tracking code: ${trackingCode}.`
                : message
            }
          },
          notifications: {
            create: {
              email: order.email,
              title: "Order dispatched",
              message: trackingCode
                ? `${order.orderNumber} was dispatched with ${service.name}. Tracking code: ${trackingCode}.`
                : `${order.orderNumber} was dispatched with ${service.name}.`
            }
          }
        }
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "courier.shipment.dispatched",
          entity: "Order",
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, courier: service.name, trackingCode }
        }
      });
    });
    return order.id;
  }

  async updateCourierShipment(id: string, dto: UpdateCourierShipmentDto) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { id },
      include: {
        order: { include: { payments: true } },
        courierService: true,
        events: { orderBy: { happenedAt: "desc" } }
      }
    });
    if (!shipment) throw new NotFoundException("Courier shipment not found.");
    if (dto.status === CourierShipmentStatus.UNKNOWN) {
      throw new BadRequestException("Choose a known parcel status.");
    }
    if (dto.status === CourierShipmentStatus.DELIVERY_FAILED && !dto.deliveryFailedReason?.trim()) {
      throw new BadRequestException("Delivery failed reason is required.");
    }
    if (dto.paymentCollected && dto.status !== CourierShipmentStatus.DELIVERED) {
      throw new BadRequestException("Payment collection can be confirmed only when the parcel is delivered.");
    }
    if (dto.paymentCollected && dto.collectedAmount !== undefined) {
      const paidAmount = roundMoney(shipment.order.payments
        .filter((payment) => payment.status === PaymentStatus.PAID)
        .reduce((sum, payment) => sum + payment.amount, 0));
      const outstanding = roundMoney(Math.max(shipment.order.total - paidAmount, 0));
      if (dto.collectedAmount <= 0 && outstanding > 0.01) {
        throw new BadRequestException("Collected amount must be greater than zero.");
      }
      if (dto.collectedAmount > outstanding + 0.01) {
        throw new BadRequestException(
          `Collected amount cannot exceed the outstanding balance (${outstanding}).`
        );
      }
    }
    const latestKnownStatus = shipment.events.find((event) =>
      event.normalizedStatus !== CourierShipmentStatus.UNKNOWN
    )?.normalizedStatus;
    const effectiveStatus = shipment.status === CourierShipmentStatus.UNKNOWN
      ? latestKnownStatus ?? shipment.status
      : shipment.status;
    const statusAlreadyRecorded = shipment.events.some((event) => event.normalizedStatus === dto.status);
    const statusChanged = dto.status !== effectiveStatus;

    if (!statusChanged && !dto.paymentCollected) {
      if (shipment.status === CourierShipmentStatus.UNKNOWN) {
        await this.prisma.courierShipment.update({
          where: { id },
          data: { status: dto.status, errorMessage: null }
        });
        return shipment.orderId;
      }
      throw new BadRequestException(
        `${dto.status.toLowerCase().replace(/_/g, " ")} has already been recorded for this parcel.`
      );
    }
    if (statusChanged && statusAlreadyRecorded) {
      throw new BadRequestException(
        `${dto.status.toLowerCase().replace(/_/g, " ")} has already been recorded for this parcel.`
      );
    }
    const updated = await this.prisma.courierShipment.update({
      where: { id },
      data: {
        status: dto.status,
        trackingCode: dto.trackingCode === undefined ? undefined : dto.trackingCode.trim() || null,
        providerOrderId: dto.providerOrderId === undefined ? undefined : dto.providerOrderId.trim() || null,
        consignmentId: dto.consignmentId === undefined ? undefined : dto.consignmentId.trim() || null,
        deliveryFailedReason:
          dto.deliveryFailedReason === undefined ? undefined : dto.deliveryFailedReason.trim() || null,
        errorMessage: null,
        events: statusChanged
          ? {
              create: {
                normalizedStatus: dto.status,
                providerStatus: dto.status,
                message: dto.message?.trim() || this.courierAdapters.defaultMessage(dto.status),
                location: dto.location?.trim() || shipment.courierService.name,
                deliveryFailedReason: dto.deliveryFailedReason?.trim() || null
              }
            }
          : undefined
      }
    });
    if (dto.paymentCollected) {
      await this.settleCourierCollection(updated.id, dto.collectedAmount);
    }
    if (statusChanged || shipment.order.status !== shipmentToOrderStatus[dto.status]) {
      await this.applyShipmentStatusToOrder(updated.id, {
        location: dto.location?.trim() || shipment.courierService.name,
        message: dto.message?.trim(),
        deliveryFailedReason: dto.deliveryFailedReason?.trim()
      });
    }
    return shipment.orderId;
  }

  async syncCourierShipment(id: string) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { id },
      include: {
        courierService: true,
        events: { orderBy: { happenedAt: "desc" } }
      }
    });
    if (!shipment) throw new NotFoundException("Courier shipment not found.");
    if (!this.courierAdapters.supportsStatusSync(shipment.courierService)) {
      throw new BadRequestException(
        shipment.courierService.provider === CourierProvider.MANUAL
          ? "Manual courier tracking cannot be synced. Save the parcel status manually."
          : "Configure a courier status endpoint before syncing this parcel."
      );
    }
    const response = await this.courierAdapters
      .for(shipment.courierService)
      .getShipmentStatus(shipment.courierService, shipment);
    const providerStatus = response.status ?? response.providerStatus ?? response.delivery_status;
    const status = this.courierAdapters.normalizeStatus(providerStatus);
    if (status === CourierShipmentStatus.UNKNOWN) {
      const receivedStatus = String(providerStatus ?? "empty status");
      await this.prisma.courierShipment.update({
        where: { id },
        data: {
          providerResponse: response as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
          errorMessage: `Unrecognized courier status: ${receivedStatus}`
        }
      });
      throw new BadRequestException(
        `Courier returned an unrecognized status (${receivedStatus}). The previous parcel status was kept.`
      );
    }
    const extracted = this.courierAdapters.extractReferences(response, {});
    const message = String(response.message ?? response.status_text ?? this.courierAdapters.defaultMessage(status));
    const failedReason = this.courierAdapters.deliveryFailedReasonFrom(response);
    const paymentCollection = this.courierAdapters.paymentCollectionFrom(response);
    if (
      shipment.status === status ||
      shipment.events.some((event) => event.normalizedStatus === status)
    ) {
      await this.prisma.courierShipment.update({
        where: { id },
        data: {
          status,
          trackingCode: extracted.trackingCode || undefined,
          providerOrderId: extracted.providerOrderId || undefined,
          consignmentId: extracted.consignmentId || undefined,
          providerResponse: response as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
          errorMessage: null
        }
      });
      if (status === CourierShipmentStatus.DELIVERED && paymentCollection.collected) {
        await this.settleCourierCollection(shipment.id, paymentCollection.amount);
      }
      return shipment.orderId;
    }
    const updated = await this.prisma.courierShipment.update({
      where: { id },
      data: {
        status,
        trackingCode: extracted.trackingCode || undefined,
        providerOrderId: extracted.providerOrderId || undefined,
        consignmentId: extracted.consignmentId || undefined,
        deliveryFailedReason:
          status === CourierShipmentStatus.DELIVERY_FAILED ? failedReason || shipment.deliveryFailedReason : undefined,
        providerResponse: response as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
        errorMessage: null,
        events: {
          create: {
            normalizedStatus: status,
            providerStatus: String(providerStatus ?? ""),
            message,
            location: String(response.location ?? shipment.courierService.name),
            deliveryFailedReason:
              status === CourierShipmentStatus.DELIVERY_FAILED ? failedReason || shipment.deliveryFailedReason : null,
            rawPayload: response as Prisma.InputJsonValue
          }
        }
      }
    });
    await this.applyShipmentStatusToOrder(updated.id, {
      location: String(response.location ?? shipment.courierService.name),
      message,
      deliveryFailedReason: status === CourierShipmentStatus.DELIVERY_FAILED
        ? failedReason || shipment.deliveryFailedReason || undefined
        : undefined
    });
    if (status === CourierShipmentStatus.DELIVERED && paymentCollection.collected) {
      await this.settleCourierCollection(updated.id, paymentCollection.amount);
    }
    return shipment.orderId;
  }

  private async findOrderForCourier(idOrNumber: string): Promise<CourierDispatchOrder> {
    const identifiers: Prisma.OrderWhereInput[] = [{ orderNumber: idOrNumber }];
    if (/^[a-f\d]{24}$/i.test(idOrNumber)) identifiers.push({ id: idOrNumber });
    const order = await this.prisma.order.findFirst({
      where: { OR: identifiers },
      include: { items: true, payments: true, courierShipments: true }
    });
    if (!order) throw new NotFoundException("Order not found.");
    return order;
  }

  private maskCourierService<T extends CourierServiceRecord & { _count?: { shipments: number } }>(service: T) {
    return {
      ...service,
      apiKey: service.apiKey ? "configured" : null,
      apiSecret: service.apiSecret ? "configured" : null,
      clientSecret: service.clientSecret ? "configured" : null,
      credentialsConfigured: Boolean(service.apiKey || service.apiSecret || service.clientId || service.clientSecret),
      apiConfigured: Boolean(service.apiBaseUrl)
    };
  }

  private paidAmount(order: Pick<CourierDispatchOrder, "payments">) {
    return roundMoney(order.payments
      .filter((payment) => paidPaymentStatuses.includes(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0));
  }

  private buildCourierDispatchPayload(
    order: CourierDispatchOrder,
    service: CourierServiceRecord,
    dto: DispatchCourierShipmentDto
  ) {
    const shippingInfo = asRecord(order.shippingInfo);
    const address =
      formatAddressInfo({
        recipient: String(shippingInfo.recipient ?? order.customerName),
        phone: String(shippingInfo.phone ?? order.phone),
        line1: String(shippingInfo.line1 ?? order.shippingAddress),
        line2: shippingInfo.line2 ? String(shippingInfo.line2) : undefined,
        area: shippingInfo.area ? String(shippingInfo.area) : undefined,
        city: shippingInfo.city ? String(shippingInfo.city) : undefined,
        postalCode: shippingInfo.postalCode ? String(shippingInfo.postalCode) : undefined
      }) || order.shippingAddress;
    const codAmount = dto.cashCollectionAmount === undefined
      ? roundMoney(Math.max(order.total - this.paidAmount(order), 0))
      : roundMoney(dto.cashCollectionAmount);
    const items = order.items.map((item) => ({
      productName: item.productName,
      option: item.variantName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: roundMoney(item.unitPrice * item.quantity)
    }));

    return {
      provider: service.provider,
      orderNumber: order.orderNumber,
      invoice: order.orderNumber,
      storeId: service.storeId,
      recipientName: String(shippingInfo.recipient ?? order.customerName),
      recipientPhone: String(shippingInfo.phone ?? order.phone),
      recipientEmail: order.email,
      recipientAddress: address,
      city: shippingInfo.city ? String(shippingInfo.city) : order.deliveryZoneName,
      area: shippingInfo.area ? String(shippingInfo.area) : order.deliveryZoneName,
      postalCode: shippingInfo.postalCode ? String(shippingInfo.postalCode) : undefined,
      deliveryZone: order.deliveryZoneName ?? order.deliveryZoneCode,
      pickupAddress: dto.pickupAddress?.trim() || service.defaultPickupAddress,
      parcelType: dto.parcelType?.trim() || "parcel",
      specialInstruction: dto.specialInstruction?.trim() || undefined,
      codAmount,
      orderTotal: order.total,
      paidAmount: this.paidAmount(order),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items
    };
  }

  /**
   * Settles the cash a courier collected on delivery.
   *
   * Order status is derived through PaymentsService.reconcileOrderPaymentStatus
   * — the single shared implementation every other payment-affecting flow uses
   * — rather than a second, local formula. The previous local version only
   * summed PAID payments, ignoring PARTIALLY_REFUNDED and REFUNDED ones, which
   * could overstate the outstanding balance (and so overstate what the courier
   * is allowed to collect) on an order that already carries a refund.
   */
  private async settleCourierCollection(shipmentId: string, requestedAmount?: number) {
    await this.prisma.$transaction(async (transaction) => {
      const shipment = await transaction.courierShipment.findUnique({
        where: { id: shipmentId },
        include: { order: true, courierService: true }
      });
      if (!shipment) throw new NotFoundException("Courier shipment not found.");
      if (shipment.status !== CourierShipmentStatus.DELIVERED) {
        throw new BadRequestException("The parcel must be delivered before recording payment collection.");
      }
      if (shipment.paymentCollectedAt) return;

      // Same netting PaymentsService.reconcileOrderPaymentStatus uses: captured
      // payments (including ones later refunded) minus completed refunds.
      const [capturedAgg, refundedAgg] = await Promise.all([
        transaction.payment.aggregate({
          where: {
            orderId: shipment.orderId,
            status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] }
          },
          _sum: { amount: true }
        }),
        transaction.refund.aggregate({
          where: { orderId: shipment.orderId, status: "COMPLETED" },
          _sum: { amount: true }
        })
      ]);
      const capturedAmount = roundMoney(Number(capturedAgg._sum.amount ?? 0));
      const refundedAmount = roundMoney(Number(refundedAgg._sum.amount ?? 0));
      const paidAmount = roundMoney(Math.max(0, capturedAmount - refundedAmount));
      const outstanding = roundMoney(Math.max(shipment.order.total - paidAmount, 0));

      if (outstanding <= 0.01) {
        // Already settled by other means before this delivery confirmation —
        // there is nothing for the courier to collect. collectedAmount stays 0
        // so the UI can tell this apart from an actual collection: an actual
        // one always validates to a positive amount below.
        await transaction.payment.updateMany({
          where: { orderId: shipment.orderId, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED }
        });
        await transaction.courierShipment.update({
          where: { id: shipment.id },
          data: { paymentCollectedAt: new Date(), collectedAmount: 0 }
        });
        await this.payments.reconcileOrderPaymentStatus(transaction, shipment.orderId);
        await transaction.order.update({
          where: { id: shipment.orderId },
          data: { amountDueOnDelivery: 0 }
        });
        return;
      }

      const collectionAmount = roundMoney(
        requestedAmount ??
        (shipment.cashCollectionAmount > 0 ? shipment.cashCollectionAmount : outstanding)
      );
      if (collectionAmount <= 0) {
        throw new BadRequestException("Collected amount must be greater than zero.");
      }
      if (collectionAmount > outstanding + 0.01) {
        throw new BadRequestException(
          `Collected amount cannot exceed the outstanding balance (${outstanding}).`
        );
      }

      const collectedAt = new Date();

      // Checkout creates a "cash" placeholder for the FULL order total the
      // moment a pure cash-on-delivery order is placed (see
      // EcommerceService.checkout — paymentRecordAmount is the whole total
      // when the order isn't paying online). That row and this collection are
      // the same money, not two payments, so it's settled in place. Creating
      // a second row and bulk-marking the placeholder FAILED below used to
      // make every completed cash-on-delivery order carry a payment that
      // reads as a failure, when the opposite happened.
      //
      // This does NOT apply to a mixed order (a partial online advance plus a
      // COD balance): there, the "cash" placeholder doesn't exist — the
      // checkout-time payment was made under the online provider instead —
      // so the lookup below finds nothing and a new row is created, correctly
      // representing a genuinely separate, additional payment.
      const codPlaceholder = await transaction.payment.findFirst({
        where: { orderId: shipment.orderId, provider: "cash", status: PaymentStatus.PENDING },
        orderBy: { createdAt: "asc" }
      });

      const transactionId = `COD-${shipment.order.orderNumber}-${shipment.id.slice(-8)}`;
      const providerPayload = {
        source: "courier_collection",
        shipmentId: shipment.id,
        courierService: shipment.courierService.name,
        collectedAt: collectedAt.toISOString()
      };

      const payment = codPlaceholder
        ? await transaction.payment.update({
            where: { id: codPlaceholder.id },
            data: {
              amount: collectionAmount,
              status: PaymentStatus.PAID,
              capturedAt: collectedAt,
              transactionId,
              gatewayReference: shipment.trackingCode,
              providerPayload
            }
          })
        : await transaction.payment.create({
            data: {
              orderId: shipment.orderId,
              provider: shipment.courierService.code,
              method: "CASH_ON_DELIVERY",
              amount: collectionAmount,
              status: PaymentStatus.PAID,
              capturedAt: collectedAt,
              transactionId,
              gatewayReference: shipment.trackingCode,
              // Never null: the unique index on this column is not sparse in
              // MongoDB, so a second key-less payment anywhere in the system
              // collides with the first and every collection after it fails.
              // A shipment only ever settles once (guarded by
              // paymentCollectedAt above), so its id is a natural, unique key.
              idempotencyKey: `cod:${shipment.id}`,
              providerPayload
            }
          });
      // Every other payment-affecting flow writes this; COD collection was
      // the one silent path, leaving cash collections invisible in a
      // payment's history.
      await this.payments.recordEvent(
        payment.id,
        {
          type: "captured",
          message: `Cash on delivery of ${collectionAmount.toFixed(2)} collected by ${shipment.courierService.name}.`,
          fromStatus: codPlaceholder ? PaymentStatus.PENDING : undefined,
          toStatus: PaymentStatus.PAID,
          source: "system",
          payload: { shipmentId: shipment.id }
        },
        transaction
      );

      await transaction.courierShipment.update({
        where: { id: shipment.id },
        data: { collectedAmount: collectionAmount, paymentCollectedAt: collectedAt }
      });

      const paymentStatus = await this.payments.reconcileOrderPaymentStatus(transaction, shipment.orderId);
      const remaining = roundMoney(Math.max(shipment.order.total - roundMoney(paidAmount + collectionAmount), 0));
      await transaction.order.update({
        where: { id: shipment.orderId },
        data: { amountDueOnDelivery: remaining }
      });

      if (paymentStatus === PaymentStatus.PAID) {
        await transaction.payment.updateMany({
          where: {
            orderId: shipment.orderId,
            status: PaymentStatus.PENDING
          },
          data: { status: PaymentStatus.FAILED }
        });
      }
    });
  }

  private async applyShipmentStatusToOrder(
    shipmentId: string,
    context: { location?: string; message?: string; deliveryFailedReason?: string }
  ) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { id: shipmentId },
      include: { order: true, courierService: true }
    });
    if (!shipment) return;
    const orderStatus = shipmentToOrderStatus[shipment.status];
    if (!orderStatus || shipment.order.status === OrderStatus.CANCELLED) return;
    const note = shipment.status === CourierShipmentStatus.DELIVERY_FAILED
      ? `Delivery failed${context.deliveryFailedReason ? `: ${context.deliveryFailedReason}` : "."}`
      : context.message || this.courierAdapters.defaultMessage(shipment.status);
    const orderStatusChanged = shipment.order.status !== orderStatus;
    await this.prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status: orderStatus,
        courierName: shipment.courierService.name,
        trackingCode: shipment.trackingCode,
        ...(orderStatusChanged
          ? {
              trackingEvents: {
                create: {
                  status: orderStatus,
                  location: context.location || shipment.courierService.name,
                  note
                }
              },
              notifications: {
                create: {
                  email: shipment.order.email,
                  title: orderStatus === OrderStatus.DELIVERY_FAILED ? "Delivery attempt failed" : "Parcel update",
                  message: `${shipment.order.orderNumber}: ${note}`
                }
              }
            }
          : {})
      }
    });
  }
}
