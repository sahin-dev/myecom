"use client";

import { useEffect } from "react";
import { AddressInfo, Order, SiteSettings, formatMoney, resolveMediaUrl } from "../../lib/catalog";
import { orderPaymentBreakdown } from "../../lib/orderPayments";

function addressLines(info?: AddressInfo | null, fallback?: string) {
  if (!info) return fallback ? [fallback] : [];
  return [
    info.recipient,
    info.phone,
    info.email,
    info.line1,
    info.line2,
    info.area,
    info.city,
    info.postalCode
  ].filter(Boolean) as string[];
}

export function PackingSlip({
  order,
  settings,
  onClose
}: {
  order: Order;
  settings: SiteSettings;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 200);
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onClose]);

  const logo = resolveMediaUrl(settings.logoUrl);
  const generatedAt = new Date().toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" });
  const paymentBreakdown = orderPaymentBreakdown(order);
  const shippingLines = addressLines(order.shippingInfo, order.shippingAddress);
  const latestShipment = order.courierShipments?.[0];

  return (
    <div className="packing-slip-overlay">
      <div className="packing-slip-toolbar">
        <button type="button" className="secondary-action" onClick={onClose}>Close</button>
        <button type="button" className="primary-action" onClick={() => window.print()}>Print</button>
      </div>
      <div className="packing-slip">
        <header>
          <div>
            {logo ? <img src={logo} alt="" /> : null}
            <strong>{settings.title}</strong>
          </div>
          <div>
            <span className="eyebrow">Packing slip</span>
            <h1>{order.orderNumber}</h1>
            <p>{new Date(order.createdAt).toLocaleDateString("en-BD", { dateStyle: "long" })}</p>
          </div>
        </header>

        <section className="packing-slip-parties">
          <div>
            <span className="eyebrow">Ship to</span>
            <strong>{shippingLines[0] ?? order.customerName}</strong>
            {shippingLines.slice(1).map((line) => <p key={line}>{line}</p>)}
          </div>
          <div>
            <span className="eyebrow">Order info</span>
            <dl>
              <div><dt>Payment</dt><dd>{order.paymentMethod ?? "Cash on delivery"}</dd></div>
              <div><dt>Payment status</dt><dd>{order.paymentStatus ?? "PENDING"}</dd></div>
              <div><dt>Delivery</dt><dd>{order.deliveryMethodName ?? "Standard delivery"}</dd></div>
              {order.courierName ? <div><dt>Courier</dt><dd>{order.courierName}</dd></div> : null}
              {order.trackingCode ? <div><dt>Tracking code</dt><dd>{order.trackingCode}</dd></div> : null}
              {latestShipment?.deliveryFailedReason ? (
                <div><dt>Delivery failed</dt><dd>{latestShipment.deliveryFailedReason}</dd></div>
              ) : null}
            </dl>
          </div>
        </section>

        <table className="packing-slip-items">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.productName}</strong>
                  {item.variantName ? <span> — {item.variantName}</span> : null}
                  {item.advancePaymentAmount ? (
                    <small>Advance {item.advancePaymentPercent ?? 0}%: {formatMoney(item.advancePaymentAmount)}</small>
                  ) : null}
                </td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td>{formatMoney(item.quantity * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="packing-slip-totals">
          <div><span>Subtotal</span><strong>{formatMoney(order.subtotal)}</strong></div>
          {order.discount ? (
            <div>
              <span>Discount{order.promotion ? ` (${order.promotion.code})` : ""}</span>
              <strong>-{formatMoney(order.discount)}</strong>
            </div>
          ) : null}
          <div><span>Delivery</span><strong>{formatMoney(order.shippingFee)}</strong></div>
          <div className="packing-slip-grand-total"><span>Total due</span><strong>{formatMoney(order.total)}</strong></div>
          {paymentBreakdown.shouldShowPaymentPlan ? (
            <>
              {paymentBreakdown.hasFailedPayment ? (
                <div className="packing-slip-payment-warning"><span>Failed payment attempt</span><strong>{formatMoney(paymentBreakdown.failedAmount)}</strong></div>
              ) : paymentBreakdown.paidAmount > 0 ? (
                <div><span>Paid online</span><strong>{formatMoney(paymentBreakdown.paidAmount)}</strong></div>
              ) : (
                <div><span>Advance required</span><strong>{formatMoney(paymentBreakdown.scheduledNow)}</strong></div>
              )}
              <div><span>Outstanding balance</span><strong>{formatMoney(paymentBreakdown.outstandingAmount)}</strong></div>
            </>
          ) : null}
        </div>

        {order.adminNote ? (
          <div className="packing-slip-note">
            <span className="eyebrow">Fulfillment note</span>
            <p>{order.adminNote}</p>
          </div>
        ) : null}

        <footer>
          <span>{order.orderNumber}</span>
          <span>Generated {generatedAt}</span>
        </footer>
      </div>
    </div>
  );
}
