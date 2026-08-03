"use client";

import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  CreditCard,
  Hash,
  MapPin,
  Package,
  PackageCheck,
  Search,
  Truck
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Order, effectiveCourierShipmentStatus, fallbackCatalog, fetchOrder } from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { PageFooter, PageHeader } from "./PageChrome";

const statusLabels: Record<string, string> = {
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERY_FAILED: "Delivery failed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  CREATED: "Parcel created",
  PICKUP_REQUESTED: "Pickup requested",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  RETURNED: "Returned",
  UNKNOWN: "Status pending"
};
const deliverySteps = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const money = (value: number) => `\u09F3${new Intl.NumberFormat("en-BD").format(value)}`;
const dateTime = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka"
});
const timeOnly = new Intl.DateTimeFormat("en-BD", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka"
});
const dateOnly = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Dhaka"
});

function formatDateTime(value?: string | null) {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return dateTime.format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeOnly.format(date);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateOnly.format(date);
}

function statusTone(status?: string | null) {
  if (!status) return "neutral";
  if (["DELIVERED", "CONFIRMED", "COMPLETED", "PAID"].includes(status)) return "success";
  if (["DELIVERY_FAILED", "CANCELLED", "RETURNED", "FAILED"].includes(status)) return "danger";
  if (["SHIPPED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(status)) return "active";
  if (["PLACED", "PACKED", "CREATED", "PICKUP_REQUESTED", "PENDING", "UNKNOWN"].includes(status)) {
    return "warning";
  }
  return "neutral";
}

export function TrackOrder() {
  const [trackingInput, setTrackingInput] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Enter the order number from your confirmation.");
  const [loading, setLoading] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
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

  const currentStep = order
    ? order.status === "DELIVERY_FAILED"
      ? deliverySteps.indexOf("OUT_FOR_DELIVERY")
      : deliverySteps.indexOf(order.status)
    : -1;
  const latestShipment = order?.courierShipments?.[0];
  const rawTimelineEvents = order
    ? [
        ...order.trackingEvents.map((event) => ({
          id: `order-${event.id}`,
          status: event.status,
          title: statusLabels[event.status] ?? event.status,
          note: event.note,
          location: event.location,
          at: event.createdAt,
          source: "Store update",
          sourceType: "order" as const
        })),
        ...(order.courierShipments ?? []).flatMap((shipment) =>
          (shipment.events ?? [])
            .filter((event) =>
              event.normalizedStatus !== "UNKNOWN" ||
              Boolean(event.deliveryFailedReason) ||
              !/no courier status endpoint/i.test(event.message)
            )
            .map((event) => ({
            id: `courier-${event.id}`,
            status: event.normalizedStatus,
            title: statusLabels[event.normalizedStatus] ?? event.normalizedStatus.replace(/_/g, " "),
            note: event.deliveryFailedReason
              ? `${event.message} Reason: ${event.deliveryFailedReason}`
              : event.message,
            location: event.location || shipment.courierService?.name || order.courierName || "Courier",
            at: event.happenedAt || event.createdAt,
            source: shipment.courierService?.name ?? "Courier",
            sourceType: "parcel" as const
            }))
        )
      ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    : [];
  const timelineEvents = rawTimelineEvents.filter((event, index, events) => {
    const key = [
      event.status,
      event.title,
      event.note,
      event.location,
      event.source
    ].join("|").toLowerCase();
    return events.findIndex((candidate) =>
      [
        candidate.status,
        candidate.title,
        candidate.note,
        candidate.location,
        candidate.source
      ].join("|").toLowerCase() === key
    ) === index;
  });
  const latestEvent = timelineEvents[0];
  const timelineGroups = timelineEvents.reduce<Array<{ key: number; at: string; events: typeof timelineEvents }>>(
    (groups, event) => {
      const minute = Math.floor(new Date(event.at).getTime() / 60000);
      const current = groups[groups.length - 1];
      if (current?.key === minute) {
        current.events.push(event);
      } else {
        groups.push({ key: minute, at: event.at, events: [event] });
      }
      return groups;
    },
    []
  );
  const visibleTimelineGroups = showAllActivity ? timelineGroups : timelineGroups.slice(0, 3);
  const parcelStatus = effectiveCourierShipmentStatus(latestShipment);

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
                <strong><Hash size={14} />{order.orderNumber}</strong>
              </div>
              <div>
                <span>Order total</span>
                <strong>{money(order.total)}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong><CreditCard size={14} />{order.paymentStatus ? order.paymentStatus.replace(/_/g, " ") : "Pending"}</strong>
              </div>
              <div>
                <span>Delivery method</span>
                <strong><Truck size={14} />{order.deliveryMethodName ?? "Standard delivery"}</strong>
              </div>
            </div>

            <section className="tracking-overview">
              <div className="tracking-overview-heading">
                <div>
                  <p className="eyebrow">Live tracking</p>
                  <h2>Delivery overview</h2>
                </div>
                <span><Clock3 size={14} />Updated {formatDateTime(latestEvent?.at ?? order.updatedAt)}</span>
              </div>

              <div className="tracking-state-grid">
                <article className="tracking-state-card" data-tone={statusTone(order.status)}>
                  <div className="tracking-state-icon"><Package size={20} /></div>
                  <div>
                    <span>Order status</span>
                    <strong>{statusLabels[order.status] ?? order.status}</strong>
                    <p>{latestEvent?.sourceType === "order" ? latestEvent.note : "Your store order is moving through fulfilment."}</p>
                  </div>
                  <b className="tracking-status-badge" data-tone={statusTone(order.status)}>
                    {statusLabels[order.status] ?? order.status}
                  </b>
                </article>

                <article className="tracking-state-card" data-tone={statusTone(parcelStatus)}>
                  <div className="tracking-state-icon"><Truck size={20} /></div>
                  <div>
                    <span>Parcel status</span>
                    <strong>{parcelStatus ? statusLabels[parcelStatus] ?? parcelStatus.replace(/_/g, " ") : "Awaiting dispatch"}</strong>
                    <p>
                      {latestShipment
                        ? `${latestShipment.courierService?.name ?? order.courierName ?? "Courier"}${latestShipment.trackingCode ? ` / ${latestShipment.trackingCode}` : ""}`
                        : "Courier details will appear after dispatch."}
                    </p>
                  </div>
                  <b className="tracking-status-badge" data-tone={statusTone(parcelStatus)}>
                    {parcelStatus ? statusLabels[parcelStatus] ?? parcelStatus.replace(/_/g, " ") : "Not dispatched"}
                  </b>
                </article>
              </div>

              {latestShipment?.deliveryFailedReason ? (
                <p className="tracking-parcel-warning">
                  Delivery failed reason: {latestShipment.deliveryFailedReason}
                </p>
              ) : null}

              <div className="delivery-progress" aria-label="Delivery progress">
                {deliverySteps.map((step, index) => {
                  const complete = currentStep >= index;
                  const current = currentStep === index;
                  return (
                    <div className={`${complete ? "complete" : ""}${current ? " current" : ""}`} key={step}>
                      <span>{complete ? <Check size={15} /> : <Circle size={15} />}</span>
                      <strong>{statusLabels[step]}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="tracking-detail-grid">
              <section className="tracking-panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">Order and parcel activity</p>
                    <h2>Tracking history</h2>
                  </div>
                  <span>{timelineEvents.length} updates in {timelineGroups.length} moments</span>
                </div>
                <div className={`tracking-timeline${showAllActivity ? " is-expanded" : ""}`}>
                  {visibleTimelineGroups.map((group, groupIndex) => (
                    <article className={`tracking-timeline-group${groupIndex === 0 ? " is-current" : ""}`} key={group.key}>
                      <div className="tracking-timeline-time">
                        <strong>{formatTime(group.at)}</strong>
                        <span>{formatDate(group.at)}</span>
                      </div>
                      <span className="tracking-timeline-dot">
                        <CheckCircle2 size={15} />
                      </span>
                      <div className="tracking-timeline-events">
                        {group.events.map((event) => (
                          <div className="tracking-event-row" key={event.id}>
                            <div className="tracking-event-heading">
                              <span className={`tracking-source-badge is-${event.sourceType}`}>
                                {event.sourceType === "order" ? "Order" : "Parcel"}
                              </span>
                              <b className="tracking-status-badge" data-tone={statusTone(event.status)}>{event.title}</b>
                            </div>
                            {event.note ? <p>{event.note}</p> : null}
                            <small>
                              <MapPin size={12} />
                              {event.location || event.source}
                            </small>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                  {!timelineGroups.length ? (
                    <article className="tracking-timeline-empty">
                      <CalendarClock size={22} />
                      <p>Timeline updates will appear as the store and courier update this order.</p>
                    </article>
                  ) : null}
                </div>
                {timelineGroups.length > 3 ? (
                  <button
                    className="tracking-history-toggle"
                    type="button"
                    onClick={() => setShowAllActivity((current) => !current)}
                    aria-expanded={showAllActivity}
                  >
                    {showAllActivity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {showAllActivity ? "Show recent activity" : `View all ${timelineEvents.length} updates`}
                  </button>
                ) : null}
              </section>
              <aside className="delivery-address">
                <Truck size={24} />
                <h2>Delivery address</h2>
                <p>{order.shippingAddress}</p>
                <span>{order.phone}</span>
                <span>{order.email}</span>
                {latestShipment?.trackingCode ? (
                  <small>Tracking code: {latestShipment.trackingCode}</small>
                ) : null}
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
