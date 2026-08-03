"use client";

import { Check, RotateCcw, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Order, executeBkashPayment, fallbackCatalog, markBkashPaymentFailed } from "../lib/catalog";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";

function gatewayCheckoutSource(paymentID: string | null) {
  if (!paymentID || typeof window === "undefined") return null;
  return window.sessionStorage.getItem(`checkout-source:${paymentID}`);
}

function forgetGatewayCheckoutSource(paymentID: string | null) {
  if (!paymentID || typeof window === "undefined") return;
  window.sessionStorage.removeItem(`checkout-source:${paymentID}`);
}

export function BkashReturn() {
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Verifying your bKash payment...");
  const { clearCart } = useCart();

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
          forgetGatewayCheckoutSource(paymentID);
          setStatus("failed");
          setMessage(
            gatewayStatus === "cancel"
              ? "You cancelled the bKash payment, so the order was cancelled automatically."
              : "The bKash payment failed, so the order was cancelled automatically."
          );
        })
        .catch(() => {
          forgetGatewayCheckoutSource(paymentID);
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
        if (gatewayCheckoutSource(paymentID) === "cart") clearCart();
        forgetGatewayCheckoutSource(paymentID);
        setStatus("success");
      })
      .catch((caught) => {
        markBkashPaymentFailed(paymentID)
          .then((failedOrder) => {
            setOrder(failedOrder);
            forgetGatewayCheckoutSource(paymentID);
            setStatus("failed");
            setMessage("The bKash payment could not be confirmed, so the order was cancelled automatically.");
          })
          .catch(() => {
            setStatus("failed");
            setMessage(caught instanceof Error ? caught.message : "The bKash payment could not be confirmed.");
          });
      });
  }, [clearCart]);

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />
      <section className="tracking-page-shell">
        {status === "verifying" ? <div className="checkout-empty">{message}</div> : null}

        {status === "success" && order ? (
          <div className="order-success">
            <Check size={34} />
            <p className="eyebrow">Order confirmed</p>
            <h2>Thank you, {order.customerName}</h2>
            <p>
              Your payment was successful. Your order number is <strong>{order.orderNumber}</strong>.
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
            <RotateCcw size={32} />
            <p>{message}</p>
            {order ? (
              <p>
                Order <strong>{order.orderNumber}</strong> has been cancelled.
              </p>
            ) : null}
            <a className="primary-action" href="/checkout">
              Try checkout again
            </a>
          </div>
        ) : null}
      </section>
      <PageFooter categories={fallbackCatalog.categories} siteSettings={fallbackCatalog.siteSettings} />
    </main>
  );
}
