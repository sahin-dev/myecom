"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  Truck
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminOrdersResponse,
  Order,
  fetchAdminOrders,
  formatMoney,
  updateAdminOrder
} from "../../lib/catalog";
import {
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  StatusBadge,
  formatStatus,
  orderStatuses,
  paymentStatuses
} from "./AdminShared";

const orderTransitions: Record<string, string[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

export function AdminOrders() {
  const [result, setResult] = useState<AdminOrdersResponse | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchAdminOrders({
        search,
        status,
        paymentStatus,
        page,
        limit: 25
      });
      setResult(next);
      if (selected) {
        const refreshed = next.orders.find((order) => order.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Orders are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [page, paymentStatus, search, selected?.id, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await updateAdminOrder(selected.id, {
        status: String(form.get("status")),
        paymentStatus: String(form.get("paymentStatus")),
        paymentMethod: String(form.get("paymentMethod") || ""),
        courierName: String(form.get("courierName") || ""),
        trackingCode: String(form.get("trackingCode") || ""),
        location: String(form.get("location") || ""),
        note: String(form.get("note") || ""),
        adminNote: String(form.get("adminNote") || "")
      });
      setSelected(updated);
      setMessage(`${updated.orderNumber} was updated and the customer was notified when needed.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Order update failed.");
    } finally {
      setSaving(false);
    }
  }

  function exportOrders() {
    if (!result?.orders.length) return;
    const rows = [
      ["Order", "Date", "Customer", "Email", "Phone", "Status", "Payment", "Items", "Total"],
      ...result.orders.map((order) => [
        order.orderNumber,
        new Date(order.createdAt).toISOString(),
        order.customerName,
        order.email,
        order.phone,
        order.status,
        order.paymentStatus ?? "PENDING",
        order.items.reduce((sum, item) => sum + item.quantity, 0),
        order.total
      ])
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !result) return <AdminLoading label="Loading the order queue..." />;
  if (error && !result) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Order operations"
        title="Orders"
        description="Search, fulfill, track, and document every customer order."
        actions={
          <>
            <button className="secondary-action" type="button" onClick={exportOrders}>
              <Download size={17} /> Export page
            </button>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh orders">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />

      <form className="admin-filterbar" onSubmit={applySearch}>
        <label className="admin-search">
          <Search size={17} />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Order, customer, email, or phone"
          />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All order statuses</option>
          {orderStatuses.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
        </select>
        <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}>
          <option value="">All payment statuses</option>
          {paymentStatuses.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
        </select>
        <button className="primary-action" type="submit">Apply</button>
      </form>

      {message ? <p className="admin-message">{message}</p> : null}

      <div className={`admin-order-workspace ${selected ? "has-detail" : ""}`}>
        <section className="admin-order-list">
          <AdminSectionHeader
            title={`${result?.pagination.total ?? 0} orders`}
            description="Newest orders are shown first"
          />
          <div className="admin-table-wrap">
            <table className="admin-table admin-orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {result?.orders.map((order) => (
                  <tr
                    key={order.id}
                    className={selected?.id === order.id ? "selected" : ""}
                    onClick={() => setSelected(order)}
                  >
                    <td>
                      <strong>{order.orderNumber}</strong>
                      <small>{new Date(order.createdAt).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}</small>
                    </td>
                    <td><strong>{order.customerName}</strong><small>{order.items.length} line items</small></td>
                    <td><StatusBadge value={order.status} /></td>
                    <td><StatusBadge value={order.paymentStatus} kind="payment" /></td>
                    <td><strong>{formatMoney(order.total)}</strong></td>
                    <td><button type="button" title={`Open ${order.orderNumber}`} onClick={(event) => { event.stopPropagation(); setSelected(order); }}><ChevronRight size={17} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result?.orders.length ? (
              <div className="admin-empty">
                <PackageSearch size={30} />
                <strong>No orders match these filters</strong>
                <p>Clear a filter or search for a different customer.</p>
              </div>
            ) : null}
          </div>
          <div className="admin-pagination">
            <span>Page {result?.pagination.page} of {result?.pagination.pages}</span>
            <div>
              <button
                type="button"
                disabled={(result?.pagination.page ?? 1) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                title="Previous page"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                disabled={(result?.pagination.page ?? 1) >= (result?.pagination.pages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                title="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>

        {selected ? (
          <aside className="admin-order-detail">
            <div className="admin-detail-head">
              <div>
                <span>Order details</span>
                <h2>{selected.orderNumber}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close order details">Close</button>
            </div>

            <div className="admin-customer-contact">
              <strong>{selected.customerName}</strong>
              <a href={`mailto:${selected.email}`}><Mail size={15} />{selected.email}</a>
              <a href={`tel:${selected.phone}`}><Phone size={15} />{selected.phone}</a>
              <p><MapPin size={15} />{selected.shippingAddress}</p>
            </div>

            <div className="admin-order-lines">
              {selected.items.map((item) => (
                <div key={item.id}>
                  <span><strong>{item.productName}</strong><small>{item.quantity} x {formatMoney(item.unitPrice)}</small></span>
                  <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
                </div>
              ))}
              <dl>
                <div><dt>Subtotal</dt><dd>{formatMoney(selected.subtotal)}</dd></div>
                <div><dt>Delivery</dt><dd>{formatMoney(selected.shippingFee)}</dd></div>
                <div><dt>Total</dt><dd>{formatMoney(selected.total)}</dd></div>
              </dl>
            </div>

            <form className="admin-order-form" key={`${selected.id}-${selected.updatedAt}`} onSubmit={saveOrder}>
              <div className="form-grid">
                <label>Order status
                  <select name="status" defaultValue={selected.status}>
                    {[selected.status, ...(orderTransitions[selected.status] ?? [])].map((item) => (
                      <option key={item} value={item}>{formatStatus(item)}</option>
                    ))}
                  </select>
                </label>
                <label>Payment
                  <select name="paymentStatus" defaultValue={selected.paymentStatus ?? "PENDING"}>
                    {paymentStatuses.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
                  </select>
                </label>
              </div>
              <label>Payment method
                <input name="paymentMethod" defaultValue={selected.paymentMethod ?? "Cash on delivery"} />
              </label>
              <div className="form-grid">
                <label>Courier
                  <input name="courierName" defaultValue={selected.courierName ?? ""} placeholder="Courier name" />
                </label>
                <label>Tracking code
                  <input name="trackingCode" defaultValue={selected.trackingCode ?? ""} placeholder="Tracking code" />
                </label>
              </div>
              <label><Truck size={15} /> Tracking location
                <input name="location" placeholder="Fulfillment center" />
              </label>
              <label>Customer update note
                <input name="note" placeholder="Packed and ready for dispatch" />
              </label>
              <label>Private admin note
                <textarea name="adminNote" defaultValue={selected.adminNote ?? ""} placeholder="Internal note, not shown to customer" />
              </label>
              <button className="primary-action full" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save order"}
              </button>
            </form>

            <div className="admin-timeline">
              <h3>Tracking history</h3>
              {selected.trackingEvents.map((event) => (
                <div key={event.id}>
                  <span />
                  <p><strong>{formatStatus(event.status)}</strong><small>{event.location} · {new Date(event.createdAt).toLocaleString("en-BD")}</small>{event.note}</p>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
