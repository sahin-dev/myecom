"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminOrdersResponse,
  AdminCatalog,
  Order,
  cancelAdminOrder,
  createAdminOrder,
  createManualRefund,
  baseProductOptionLabel,
  fetchAdminCatalog,
  fetchAdminOrders,
  formatMoney,
  isBaseProductEnabled,
  updateAdminOrder
} from "../../lib/catalog";
import { useAuth } from "../AuthContext";
import { useSiteSettings } from "../SiteSettingsContext";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  formatStatus,
  orderStatuses,
  paymentStatuses,
  useAdminToast
} from "./AdminShared";
import { PackingSlip } from "./PackingSlip";

const orderTransitions: Record<string, string[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
};

function defaultOrderVariant(product: AdminCatalog["products"][number]) {
  if (isBaseProductEnabled(product) && product.inventory > 0) return undefined;
  return product.variants?.find((variant) => variant.isActive && variant.inventory > 0)?.id
    ?? product.variants?.find((variant) => variant.isActive)?.id;
}

export function AdminOrders() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const can = (permission: string) =>
    Boolean(user?.permissions.includes("*") || user?.permissions.includes(permission));
  const [result, setResult] = useState<AdminOrdersResponse | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [draftItems, setDraftItems] = useState<Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message, kind, notify } = useAdminToast();
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);

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
    setSelectedIds(new Set());
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
      notify(`${updated.orderNumber} was updated and the customer was notified when needed.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Order update failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function beginCreateOrder() {
    setSelected(null);
    setCreating(true);
    try {
      const nextCatalog = catalog ?? await fetchAdminCatalog();
      setCatalog(nextCatalog);
      const first = nextCatalog.products.find((product) => product.status === "ACTIVE");
      setDraftItems(first ? [{
        productId: first.id,
        variantId: defaultOrderVariant(first),
        quantity: 1
      }] : []);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Products could not be loaded.", "error");
      setCreating(false);
    }
  }

  function updateDraftItem(
    index: number,
    input: Partial<{ productId: string; variantId?: string; quantity: number }>
  ) {
    setDraftItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (input.productId) {
        const product = catalog?.products.find((candidate) => candidate.id === input.productId);
        return {
          productId: input.productId,
          variantId: product ? defaultOrderVariant(product) : undefined,
          quantity: item.quantity
        };
      }
      return { ...item, ...input };
    }));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftItems.length) return;
    setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      const order = await createAdminOrder({
        customerName: String(data.get("customerName")),
        email: String(data.get("email")),
        phone: String(data.get("phone")),
        shippingAddress: String(data.get("shippingAddress")),
        paymentMethod: String(data.get("paymentMethod") || ""),
        deliveryMethodCode: String(data.get("deliveryMethodCode") || ""),
        items: draftItems
      });
      setCreating(false);
      setSelected(order);
      notify(`${order.orderNumber} was created and inventory was reserved.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Order could not be created.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function issueRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundTarget) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const reason = String(form.get("reason") || "").trim();
    if (!amount || amount <= 0 || !reason) return;
    setSaving(true);
    try {
      await createManualRefund(refundTarget.id, { amount, reason });
      notify(`A refund of ${formatMoney(amount)} was queued for ${refundTarget.orderNumber}.`);
      setRefundTarget(null);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Refund could not be issued.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder(order: Order) {
    setSaving(true);
    setCancelTarget(null);
    try {
      const cancelled = await cancelAdminOrder(order.id);
      setSelected(cancelled);
      notify(`${cancelled.orderNumber} was cancelled and its inventory was released.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Order could not be cancelled.", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === (result?.orders.length ?? 0)
        ? new Set()
        : new Set(result?.orders.map((order) => order.id))
    );
  }

  async function applyBulkStatus() {
    if (!bulkStatus || !selectedIds.size) return;
    setBulkApplying(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => updateAdminOrder(id, { status: bulkStatus }))
      );
      notify(`${selectedIds.size} order${selectedIds.size === 1 ? "" : "s"} moved to ${formatStatus(bulkStatus)}.`);
      setSelectedIds(new Set());
      setBulkStatus("");
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Bulk status update failed.", "error");
    } finally {
      setBulkApplying(false);
    }
  }

  function downloadOrdersCsv(orders: Order[], filenamePrefix: string) {
    if (!orders.length) return;
    const rows = [
      ["Order", "Date", "Customer", "Email", "Phone", "Status", "Payment", "Items", "Total"],
      ...orders.map((order) => [
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
    anchor.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportOrders() {
    downloadOrdersCsv(result?.orders ?? [], "orders");
  }

  function exportSelected() {
    downloadOrdersCsv((result?.orders ?? []).filter((order) => selectedIds.has(order.id)), "orders-selected");
  }

  const bulkNextStatuses = [...selectedIds].reduce<string[] | null>((common, id) => {
    const order = result?.orders.find((item) => item.id === id);
    const options = order ? orderTransitions[order.status] ?? [] : [];
    return common === null ? options : common.filter((status) => options.includes(status));
  }, null) ?? [];

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
            {can("orders.create") ? <button className="primary-action" type="button" onClick={() => void beginCreateOrder()}>
              <Plus size={17} /> Create order
            </button> : null}
            {can("orders.export") ? <button className="secondary-action" type="button" onClick={exportOrders}>
              <Download size={17} /> Export page
            </button> : null}
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

      <AdminToast message={message} kind={kind} />

      {cancelTarget ? (
        <AdminConfirmDialog
          title={`Cancel ${cancelTarget.orderNumber}?`}
          body="Reserved inventory will be released back into stock."
          confirmLabel="Cancel order"
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => void cancelOrder(cancelTarget)}
        />
      ) : null}

      {refundTarget ? (
        <div className="admin-confirm-overlay" role="dialog" aria-modal="true">
          <form className="admin-confirm-card" onSubmit={issueRefund}>
            <h3>Issue refund for {refundTarget.orderNumber}</h3>
            <p>Order total: {formatMoney(refundTarget.total)}. The amount can't exceed the order's remaining refundable balance.</p>
            <label>Amount
              <input name="amount" type="number" min="1" max={refundTarget.total} step="0.01" required autoFocus />
            </label>
            <label>Reason
              <input name="reason" type="text" placeholder="Goodwill adjustment, damaged item, etc." required />
            </label>
            <div className="admin-confirm-actions">
              <button type="button" className="secondary-action" onClick={() => setRefundTarget(null)}>Cancel</button>
              <button type="submit" className="primary-action" disabled={saving}>{saving ? "Issuing..." : "Issue refund"}</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className={`admin-order-workspace ${selected || creating ? "has-detail" : ""}`}>
        <section className="admin-order-list">
          <AdminSectionHeader
            title={`${result?.pagination.total ?? 0} orders`}
            description="Newest orders are shown first"
          />
          {selectedIds.size ? (
            <div className="admin-bulk-toolbar">
              <span>{selectedIds.size} selected</span>
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} disabled={!bulkNextStatuses.length}>
                <option value="">{bulkNextStatuses.length ? "Move to..." : "No shared next status"}</option>
                {bulkNextStatuses.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
              </select>
              <button type="button" className="secondary-action" disabled={!bulkStatus || bulkApplying} onClick={() => void applyBulkStatus()}>
                {bulkApplying ? "Applying..." : "Apply"}
              </button>
              {can("orders.export") ? (
                <button type="button" className="secondary-action" onClick={exportSelected}>
                  <Download size={15} /> Export selected
                </button>
              ) : null}
              <button type="button" className="text-link" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          ) : null}
          <div className="admin-table-wrap">
            <table className="admin-table admin-orders-table">
              <thead>
                <tr>
                  <th aria-label="Select all">
                    <input
                      type="checkbox"
                      checked={Boolean(result?.orders.length) && selectedIds.size === result?.orders.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
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
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(order);
                      }
                    }}
                  >
                    <td onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelected(order.id)} aria-label={`Select ${order.orderNumber}`} />
                    </td>
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

        {creating && catalog ? (
          <aside className="admin-order-detail admin-create-order">
            <div className="admin-detail-head">
              <div><span>Manual order</span><h2>Create order</h2></div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Close create order">Close</button>
            </div>
            <form className="admin-order-form" onSubmit={submitOrder}>
              <div className="form-grid">
                <label>Customer name<input name="customerName" placeholder="Full name" required /></label>
                <label>Email<input name="email" type="email" placeholder="customer@example.com" required /></label>
              </div>
              <label>Phone<input name="phone" placeholder="+880..." required /></label>
              <label>Shipping address<textarea name="shippingAddress" placeholder="House, road, area, city, postal code" required /></label>
              <div className="admin-manual-order-lines">
                <header><span><strong>Order items</strong><small>Prices and inventory are validated when the order is created.</small></span><button type="button" onClick={() => {
                  const first = catalog.products.find((product) => product.status === "ACTIVE");
                  if (first) setDraftItems((current) => [...current, { productId: first.id, variantId: defaultOrderVariant(first), quantity: 1 }]);
                }}><Plus size={15} /> Add line</button></header>
                {draftItems.map((item, index) => {
                  const product = catalog.products.find((candidate) => candidate.id === item.productId);
                  const variants = product?.variants?.filter((variant) => variant.isActive) ?? [];
                  const variant = variants.find((candidate) => candidate.id === item.variantId);
                  return (
                    <div key={`${index}-${item.productId}`}>
                      <label>Product<select value={item.productId} onChange={(event) => updateDraftItem(index, { productId: event.target.value })}>{catalog.products.filter((candidate) => candidate.status === "ACTIVE").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
                      <label>Option<select value={item.variantId ?? ""} disabled={!variants.length} onChange={(event) => updateDraftItem(index, { variantId: event.target.value || undefined })}>
                        {!variants.length ? <option value="">{product ? baseProductOptionLabel(product) : "Standard"}</option> : null}
                        {variants.length && product && isBaseProductEnabled(product) ? (
                          <option value="">{baseProductOptionLabel(product)} · {formatMoney(product.price)}</option>
                        ) : null}
                        {variants.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {formatMoney(candidate.price)}</option>)}
                      </select></label>
                      <label>Qty<input type="number" min="1" max={variant?.inventory ?? product?.inventory ?? 1} value={item.quantity} onChange={(event) => updateDraftItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
                      <button type="button" disabled={draftItems.length === 1} onClick={() => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="Remove line"><Trash2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
              <div className="form-grid">
                <label>Payment method<select name="paymentMethod">{catalog.checkoutMethods.filter((method) => method.type === "PAYMENT" && method.isActive).map((method) => <option key={method.id} value={method.code}>{method.name}</option>)}</select></label>
                <label>Delivery method<select name="deliveryMethodCode">{catalog.checkoutMethods.filter((method) => method.type === "DELIVERY" && method.isActive).map((method) => <option key={method.id} value={method.code}>{method.name}{method.fee ? ` · ${formatMoney(method.fee)}` : " · Free"}</option>)}</select></label>
              </div>
              <div className="admin-manual-total"><span>Item subtotal</span><strong>{formatMoney(draftItems.reduce((sum, item) => {
                const product = catalog.products.find((candidate) => candidate.id === item.productId);
                const variant = product?.variants?.find((candidate) => candidate.id === item.variantId);
                return sum + (variant?.price ?? product?.price ?? 0) * item.quantity;
              }, 0))}</strong></div>
              <div className="admin-editor-sticky-actions">
                <button className="secondary-action" type="button" onClick={() => setCreating(false)}>Cancel</button>
                <button className="primary-action" type="submit" disabled={saving || !draftItems.length}><ShoppingBag size={16} /> {saving ? "Creating order..." : "Create order"}</button>
              </div>
            </form>
          </aside>
        ) : selected ? (
          <aside className="admin-order-detail">
            <div className="admin-detail-head">
              <div>
                <span>Order details</span>
                <h2>{selected.orderNumber}</h2>
              </div>
              <button type="button" className="admin-detail-print" onClick={() => setPrintingOrder(selected)} title="Print packing slip">
                <Printer size={16} /> Packing slip
              </button>
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
                {selected.discount ? (
                  <div>
                    <dt>Discount{selected.promotion ? ` (${selected.promotion.code})` : ""}</dt>
                    <dd>-{formatMoney(selected.discount)}</dd>
                  </div>
                ) : null}
                <div><dt>Delivery{selected.deliveryMethodName ? ` · ${selected.deliveryMethodName}` : ""}</dt><dd>{formatMoney(selected.shippingFee)}</dd></div>
                <div><dt>Total</dt><dd>{formatMoney(selected.total)}</dd></div>
              </dl>
            </div>

            {can("orders.update") ? <form className="admin-order-form" key={`${selected.id}-${selected.updatedAt}`} onSubmit={saveOrder}>
              <div className="form-grid">
                <label>Order status
                  <select name="status" defaultValue={selected.status}>
                    {[selected.status, ...(orderTransitions[selected.status] ?? []).filter((item) => item !== "CANCELLED")].map((item) => (
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
                <select name="paymentMethod" defaultValue={selected.paymentMethod ?? "Cash on delivery"}>
                  {!catalog?.checkoutMethods.some((method) => method.type === "PAYMENT" && method.isActive && method.name === selected.paymentMethod) && selected.paymentMethod ? (
                    <option value={selected.paymentMethod}>{selected.paymentMethod} (inactive)</option>
                  ) : null}
                  {catalog?.checkoutMethods.filter((method) => method.type === "PAYMENT" && method.isActive).map((method) => (
                    <option key={method.id} value={method.name}>{method.name}</option>
                  ))}
                </select>
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
              <div className="admin-editor-sticky-actions">
                <span />
                <button className="primary-action" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save order"}
                </button>
              </div>
            </form> : null}
            {can("orders.delete") && ["PLACED", "CONFIRMED", "PACKED"].includes(selected.status) ? <button className="danger-action admin-cancel-order" type="button" disabled={saving} onClick={() => setCancelTarget(selected)}>Cancel order</button> : null}
            {can("refunds.write") && ["PAID", "PARTIALLY_REFUNDED"].includes(selected.paymentStatus ?? "") ? <button className="secondary-action" type="button" disabled={saving} onClick={() => setRefundTarget(selected)}>Issue refund</button> : null}

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

      {printingOrder ? (
        <PackingSlip order={printingOrder} settings={settings} onClose={() => setPrintingOrder(null)} />
      ) : null}
    </div>
  );
}
