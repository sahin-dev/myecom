"use client";

import {
  Check,
  CheckCircle2,
  Circle,
  MapPin,
  PackageCheck,
  Search,
  Truck
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Order, fallbackCatalog, fetchOrder } from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { PageFooter, PageHeader } from "./PageChrome";

const statusLabels: Record<string, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled"
};
const deliverySteps = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const money = (value: number) => `\u09F3${new Intl.NumberFormat("en-BD").format(value)}`;

export function TrackOrder() {
  const [trackingInput, setTrackingInput] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Enter the order number from your confirmation.");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const orderNumber = search.get("order");
    const orderEmail = search.get("email") || user?.email || "";
    if (orderEmail) setEmail(orderEmail);
    if (orderNumber && orderEmail) {
      setTrackingInput(orderNumber);
      void lookup(orderNumber, orderEmail);
    }
  }, [user?.email]);

  async function lookup(orderNumber: string, orderEmail: string) {
    if (!orderNumber.trim() || !orderEmail.trim()) return;
    setLoading(true);
    try {
      const found = await fetchOrder(orderNumber.trim(), orderEmail.trim());
      setOrder(found);
      setMessage(`We found ${found.orderNumber}.`);
    } catch {
      setOrder(null);
      setMessage("We could not find that order. Check the number and try again.");
    } finally {
      setLoading(false);
    }
  }

  function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(trackingInput, email);
  }

  const currentStep = order ? deliverySteps.indexOf(order.status) : -1;

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />

      <section className="tracking-hero">
        <div>
          <p className="eyebrow">Delivery updates</p>
          <h1>Track your order</h1>
          <p>See where your order is and what happens next.</p>
        </div>
        <PackageCheck size={80} strokeWidth={1.2} />
      </section>

      <section className="tracking-page-shell">
        <div className="tracking-search-panel">
          <h2>Find your delivery</h2>
          <p>{message}</p>
          <form className="tracking-search-form" onSubmit={track}>
            <label>
              <span>Order number</span>
              <div className="tracking-fields">
                <input
                  value={trackingInput}
                  onChange={(event) => setTrackingInput(event.target.value)}
                  placeholder="For example, ME-12345678"
                  required
                />
                <input
                  value={email}
                  type="email"
                  suppressHydrationWarning
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Checkout email"
                  required
                />
                <button className="primary-action" type="submit" disabled={loading}>
                  <Search size={18} />
                  {loading ? "Checking..." : "Track order"}
                </button>
              </div>
            </label>
          </form>
          <p className="tracking-help">
            Use the order number and email from your checkout confirmation.
          </p>
        </div>

        {order ? (
          <>
            <div className="tracking-order-summary">
              <div>
                <span>Order number</span>
                <strong>{order.orderNumber}</strong>
              </div>
              <div>
                <span>Current status</span>
                <strong>{statusLabels[order.status] ?? order.status}</strong>
              </div>
              <div>
                <span>Order total</span>
                <strong>{money(order.total)}</strong>
              </div>
              <div>
                <span>Delivering to</span>
                <strong>{order.customerName}</strong>
              </div>
            </div>

            <div className="delivery-progress" aria-label="Delivery progress">
              {deliverySteps.map((step, index) => {
                const complete = currentStep >= index;
                return (
                  <div className={complete ? "complete" : ""} key={step}>
                    <span>{complete ? <Check size={17} /> : <Circle size={17} />}</span>
                    <strong>{statusLabels[step]}</strong>
                  </div>
                );
              })}
            </div>

            <div className="tracking-detail-grid">
              <section className="tracking-panel">
                <div className="section-title">
                  <h2>Tracking history</h2>
                </div>
                <div className="timeline">
                  {order.trackingEvents.map((event) => (
                    <article className="timeline-item" key={event.id}>
                      <CheckCircle2 size={20} />
                      <div>
                        <strong>{statusLabels[event.status] ?? event.status}</strong>
                        <p>{event.note}</p>
                        <small>
                          <MapPin size={13} />
                          {event.location}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="delivery-address">
                <Truck size={24} />
                <h2>Delivery address</h2>
                <p>{order.shippingAddress}</p>
                <span>{order.phone}</span>
                <span>{order.email}</span>
              </aside>
            </div>
          </>
        ) : (
          <div className="tracking-empty-state">
            <Truck size={48} strokeWidth={1.4} />
            <h2>Your delivery journey will appear here</h2>
            <p>Enter an order number above to see its latest status and tracking history.</p>
          </div>
        )}
      </section>

      <PageFooter categories={fallbackCatalog.categories} />
    </main>
  );
}
