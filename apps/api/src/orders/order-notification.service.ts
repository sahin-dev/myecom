import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

type OrderForEmail = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  total: number;
  trackingCode: string | null;
  courierName: string | null;
};

/** Subject and body copy per status. Statuses absent here are not emailed. */
const TEMPLATES: Partial<
  Record<OrderStatus, (order: OrderForEmail) => { subject: string; heading: string; body: string[] }>
> = {
  [OrderStatus.CONFIRMED]: (order) => ({
    subject: `Order ${order.orderNumber} confirmed`,
    heading: "Your order is confirmed",
    body: [
      `Thanks ${order.customerName} — we have your order and are getting it ready.`,
      "We'll email you again the moment it ships."
    ]
  }),
  [OrderStatus.PACKED]: (order) => ({
    subject: `Order ${order.orderNumber} is packed`,
    heading: "Your order is packed",
    body: [`${order.orderNumber} is packed and waiting for the courier to collect it.`]
  }),
  [OrderStatus.SHIPPED]: (order) => ({
    subject: `Order ${order.orderNumber} has shipped`,
    heading: "Your order is on its way",
    body: [
      `${order.orderNumber} has left our warehouse.`,
      order.trackingCode
        ? `Track it with ${order.courierName ?? "the courier"} using ${order.trackingCode}.`
        : "We'll share a tracking code as soon as the courier provides one."
    ]
  }),
  [OrderStatus.OUT_FOR_DELIVERY]: (order) => ({
    subject: `Order ${order.orderNumber} is out for delivery`,
    heading: "Arriving today",
    body: [`${order.orderNumber} is with the courier and should reach you today.`]
  }),
  [OrderStatus.DELIVERED]: (order) => ({
    subject: `Order ${order.orderNumber} delivered`,
    heading: "Delivered",
    body: [
      `${order.orderNumber} has been delivered. We hope everything is right.`,
      "If anything is wrong, reply to this email and we'll sort it out."
    ]
  }),
  [OrderStatus.DELIVERY_FAILED]: (order) => ({
    subject: `We could not deliver order ${order.orderNumber}`,
    heading: "Delivery attempt failed",
    body: [
      `The courier could not deliver ${order.orderNumber} today.`,
      "They will try again. Reply to this email if you'd like to change the address or timing."
    ]
  }),
  [OrderStatus.RETURNED_TO_ORIGIN]: (order) => ({
    subject: `Order ${order.orderNumber} came back to us`,
    heading: "Your order was returned to us",
    body: [
      `${order.orderNumber} could not be delivered and has come back to our warehouse.`,
      "Any money you paid is being returned. Reply to this email if you'd like us to send it again."
    ]
  }),
  [OrderStatus.CANCELLED]: (order) => ({
    subject: `Order ${order.orderNumber} cancelled`,
    heading: "Your order was cancelled",
    body: [
      `${order.orderNumber} has been cancelled.`,
      "Anything you already paid is being refunded to the original payment method."
    ]
  })
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string
  );

/**
 * Sends order email and records what actually went out.
 *
 * Notification rows were being written on every status change but nothing ever
 * delivered them, so customers heard nothing between checkout and the parcel
 * arriving. Delivery is best-effort: a failing mail server must never roll back
 * the status change that triggered it, so failures are stored on the row and
 * logged rather than thrown.
 */
@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  private storefrontUrl() {
    return (
      this.config.get<string>("WEB_ORIGINS")?.split(",")[0]?.trim() ?? "http://localhost:3000"
    );
  }

  private render(order: OrderForEmail, heading: string, body: string[]) {
    const url = `${this.storefrontUrl()}/orders/${encodeURIComponent(order.orderNumber)}`;
    const text = [heading, "", ...body, "", `View your order: ${url}`].join("\n");
    const paragraphs = body
      .filter(Boolean)
      .map((line) => `<p style="margin:0 0 12px;line-height:1.55">${escapeHtml(line)}</p>`)
      .join("");
    const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#2b2118">
  <h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${escapeHtml(heading)}</h1>
  ${paragraphs}
  <p style="margin:22px 0 0">
    <a href="${url}" style="display:inline-block;padding:11px 18px;border-radius:6px;background:#2b2118;color:#fff;text-decoration:none;font-weight:600">View your order</a>
  </p>
  <p style="margin:24px 0 0;font-size:13px;color:#7a6c5d">Order ${escapeHtml(order.orderNumber)}</p>
</div>`;
    return { html, text };
  }

  /**
   * Emails the customer about a status change and stores the outcome on the
   * matching Notification row. Never throws.
   */
  async sendStatusEmail(orderId: string, status: OrderStatus) {
    const template = TEMPLATES[status];
    if (!template) return { sent: false, reason: "no template for this status" };

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        email: true,
        total: true,
        trackingCode: true,
        courierName: true
      }
    });
    if (!order?.email) return { sent: false, reason: "no email on the order" };

    const { subject, heading, body } = template(order);
    const { html, text } = this.render(order, heading, body);

    // Attach the outcome to the newest notification for this order, which is the
    // one the status change just created.
    const notification = await this.prisma.notification.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    try {
      const result = await this.mail.send({ to: order.email, subject, html, text });
      if (notification) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            channel: "email",
            emailedAt: result.delivered ? new Date() : null,
            emailError: result.delivered ? null : "SMTP is not configured; logged only."
          }
        });
      }
      return { sent: result.delivered };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sending failed.";
      this.logger.warn(`Order email for ${order.orderNumber} failed: ${message}`);
      if (notification) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { channel: "email", emailError: message }
        });
      }
      return { sent: false, reason: message };
    }
  }

  /** Confirmation sent the moment an order is placed. */
  async sendOrderPlaced(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        email: true,
        total: true,
        trackingCode: true,
        courierName: true,
        items: { select: { productName: true, quantity: true, unitPrice: true } }
      }
    });
    if (!order?.email) return { sent: false };

    const lines = order.items.map(
      (item) => `${item.quantity} x ${item.productName} — ${item.unitPrice.toFixed(2)}`
    );
    const { html, text } = this.render(order, "Thanks for your order", [
      `We've received ${order.orderNumber}, ${order.customerName}.`,
      ...lines,
      `Total: ${order.total.toFixed(2)}`,
      "We'll email you as soon as it's confirmed and again when it ships."
    ]);

    try {
      await this.prisma.notification.create({
        data: {
          orderId: order.id,
          email: order.email,
          title: "Order received",
          message: `We've received ${order.orderNumber}.`,
          channel: "email"
        }
      });
      const result = await this.mail.send({
        to: order.email,
        subject: `We received order ${order.orderNumber}`,
        html,
        text
      });
      return { sent: result.delivered };
    } catch (error) {
      this.logger.warn(
        `Order confirmation for ${order.orderNumber} failed: ${
          error instanceof Error ? error.message : error
        }`
      );
      return { sent: false };
    }
  }
}
