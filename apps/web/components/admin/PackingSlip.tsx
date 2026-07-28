"use client";

import { useEffect } from "react";
import { Order, SiteSettings, formatMoney, resolveMediaUrl } from "../../lib/catalog";

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
            <strong>{order.customerName}</strong>
            <p>{order.shippingAddress}</p>
            <p>{order.phone}</p>
          </div>
          <div>
            <span className="eyebrow">Order info</span>
            <dl>
              <div><dt>Payment</dt><dd>{order.paymentMethod ?? "Cash on delivery"}</dd></div>
              <div><dt>Payment status</dt><dd>{order.paymentStatus ?? "PENDING"}</dd></div>
              <div><dt>Delivery</dt><dd>{order.deliveryMethodName ?? "Standard delivery"}</dd></div>
              {order.courierName ? <div><dt>Courier</dt><dd>{order.courierName}</dd></div> : null}
              {order.trackingCode ? <div><dt>Tracking code</dt><dd>{order.trackingCode}</dd></div> : null}
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
