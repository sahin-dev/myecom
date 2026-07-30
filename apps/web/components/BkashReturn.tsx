"use client";

import { Check, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Order, executeBkashPayment, fallbackCatalog, markBkashPaymentFailed } from "../lib/catalog";
import { PageFooter, PageHeader } from "./PageChrome";

export function BkashReturn() {
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Verifying your bKash payment...");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const paymentID = search.get("paymentID");
    const gatewayStatus = search.get("status");

    if (!paymentID) {
      setStatus("failed");
      setMessage("The bKash payment was not completed.");
      return;
    }

    if (gatewayStatus === "cancel" || gatewayStatus === "failure") {
      markBkashPaymentFailed(paymentID)
        .then((failedOrder) => {
          setOrder(failedOrder);
          setStatus("failed");
          setMessage(
            gatewayStatus === "cancel"
              ? "You cancelled the bKash payment before it completed."
              : "The bKash payment was not completed."
          );
        })
        .catch(() => {
          setStatus("failed");
          setMessage(
            gatewayStatus === "cancel"
              ? "You cancelled the bKash payment before it completed."
              : "The bKash payment was not completed."
          );
        });
      return;
    }

    executeBkashPayment(paymentID)
      .then((confirmedOrder) => {
        setOrder(confirmedOrder);
        setStatus("success");
      })
      .catch((caught) => {
        setStatus("failed");
        setMessage(caught instanceof Error ? caught.message : "The bKash payment could not be confirmed.");
      });
  }, []);

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />
      <section className="tracking-page-shell">
        {status === "verifying" ? <div className="checkout-empty">{message}</div> : null}

        {status === "success" && order ? (
          <div className="order-success">
            <Check size={34} />
            <p className="eyebrow">Payment confirmed</p>
            <h2>Thank you, {order.customerName}</h2>
            <p>
              Your bKash payment for order <strong>{order.orderNumber}</strong> was successful.
            </p>
            <a
              className="primary-action"
              href={`/track-order?order=${order.orderNumber}&email=${encodeURIComponent(order.email)}`}
            >
              <Truck size={18} /> Track this order
            </a>
          </div>
        ) : null}

        {status === "failed" ? (
          <div className="checkout-empty">
            <p>{message}</p>
            {order ? (
              <p>
                Order <strong>{order.orderNumber}</strong> is saved with payment failed.
              </p>
            ) : null}
            <a className="primary-action" href="/checkout">
              Return to checkout
            </a>
          </div>
        ) : null}
      </section>
      <PageFooter categories={fallbackCatalog.categories} siteSettings={fallbackCatalog.siteSettings} />
    </main>
  );
}
