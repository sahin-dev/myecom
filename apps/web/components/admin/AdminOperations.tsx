"use client";

import {
  Banknote,
  CheckCircle2,
  Gift,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Truck,
  XCircle
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCatalog,
  InventoryMovement,
  PurchaseOrder,
  Refund,
  ReturnRequest,
  Supplier,
  createPurchaseOrder,
  createSupplier,
  deleteSupplier,
  fetchAdminCatalog,
  fetchAdminReturns,
  fetchAdminRefunds,
  fetchInventoryMovements,
  fetchPurchaseOrders,
  fetchSuppliers,
  formatMoney,
  updateAdminReturn,
  updateAdminRefund,
  updatePurchaseOrder,
  updateSupplier
} from "../../lib/catalog";
import {
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  StatusBadge
} from "./AdminShared";

const returnTransitions: Record<string, string[]> = {
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["REFUND_PENDING", "RESOLVED"],
  REFUND_PENDING: [],
  REFUNDED: [],
  REJECTED: [],
  CANCELLED: [],
  RESOLVED: []
};

const refundTransitions: Record<Refund["status"], Refund["status"][]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  FAILED: ["PENDING"],
  COMPLETED: []
};

export function AdminOperations() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [returnFilter, setReturnFilter] = useState("OPEN");
  const [selectedReturnId, setSelectedReturnId] = useState("");
  const [returnResolution, setReturnResolution] = useState("");
  const [returnResolutionType, setReturnResolutionType] =
    useState<NonNullable<ReturnRequest["resolutionType"]>>("REFUND");
  const [returnDispositions, setReturnDispositions] = useState<
    Record<string, NonNullable<ReturnRequest["items"][number]["disposition"]>>
  >({});
  const [updatingReturn, setUpdatingReturn] = useState(false);

  const filteredReturns = useMemo(
    () => returns.filter((item) =>
      returnFilter === "ALL"
        ? true
        : returnFilter === "OPEN"
          ? !["REFUNDED", "RESOLVED", "REJECTED", "CANCELLED"].includes(item.status)
          : item.status === returnFilter
    ),
    [returnFilter, returns]
  );
  const selectedReturn =
    filteredReturns.find((item) => item.id === selectedReturnId) ??
    filteredReturns[0] ??
    null;

  useEffect(() => {
    setReturnResolution(selectedReturn?.resolution ?? "");
    setReturnResolutionType(selectedReturn?.resolutionType ?? "REFUND");
    setReturnDispositions(Object.fromEntries(
      (selectedReturn?.items ?? [])
        .filter((item) => item.disposition)
        .map((item) => [item.id, item.disposition!])
    ));
  }, [selectedReturn?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [returnData, supplierData, poData, movementData, catalogData, refundData] = await Promise.all([
        fetchAdminReturns(),
        fetchSuppliers(),
        fetchPurchaseOrders(),
        fetchInventoryMovements(),
        fetchAdminCatalog(),
        fetchAdminRefunds()
      ]);
      setReturns(returnData);
      setSuppliers(supplierData);
      setPurchaseOrders(poData);
      setMovements(movementData);
      setCatalog(catalogData);
      setRefunds(refundData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operations data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function selectReturn(item: ReturnRequest) {
    setSelectedReturnId(item.id);
    setReturnResolution(item.resolution ?? "");
    setReturnResolutionType(item.resolutionType ?? "REFUND");
    setReturnDispositions(Object.fromEntries(
      item.items
        .filter((returnItem) => returnItem.disposition)
        .map((returnItem) => [returnItem.id, returnItem.disposition!])
    ));
    setMessage("");
  }

  async function resolveReturn(item: ReturnRequest, status: string) {
    if (status === "REJECTED" && !returnResolution.trim()) {
      setMessage("Add a reason before rejecting this return.");
      return;
    }
    if (status === "RECEIVED" && item.items.some((line) => !returnDispositions[line.id])) {
      setMessage("Choose restock, inspect, damaged, or dispose for every returned item.");
      return;
    }
    if (status === "RESOLVED" && returnResolutionType === "REFUND") {
      setMessage("Choose replacement, store credit, or no action to resolve without a refund.");
      return;
    }
    setUpdatingReturn(true);
    try {
      const updated = await updateAdminReturn(item.id, {
        status,
        resolution: returnResolution.trim() || undefined,
        resolutionType:
          status === "REFUND_PENDING" || status === "RESOLVED"
            ? returnResolutionType
            : undefined,
        items:
          status === "RECEIVED"
            ? item.items.map((returnItem) => ({
              returnItemId: returnItem.id,
                disposition: returnDispositions[returnItem.id]!
              }))
            : undefined
      });
      setReturns((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setSelectedReturnId(updated.id);
      setReturnResolution(updated.resolution ?? "");
      setMessage(`${item.returnNumber} moved to ${status.toLowerCase()}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Return could not be updated.");
    } finally {
      setUpdatingReturn(false);
    }
  }

  async function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const input = {
        name: String(data.get("name")),
        contactName: String(data.get("contactName") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        leadTimeDays: Number(data.get("leadTimeDays") || 7),
        isActive: editingSupplier?.isActive ?? true
      };
      const created = editingSupplier
        ? await updateSupplier(editingSupplier.id, input)
        : await createSupplier(input);
      setSuppliers((current) => editingSupplier
        ? current.map((item) => item.id === created.id ? created : item)
        : [created, ...current]);
      setEditingSupplier(null);
      form.reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Supplier could not be created.");
    }
  }

  async function addPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const created = await createPurchaseOrder({
        supplierId: String(data.get("supplierId")),
        expectedAt: String(data.get("expectedAt") || "") || undefined,
        notes: String(data.get("notes") || ""),
        items: [{
          productId: String(data.get("productId")),
          quantity: Number(data.get("quantity")),
          unitCost: Number(data.get("unitCost"))
        }]
      });
      setPurchaseOrders((current) => [created, ...current]);
      form.reset();
      setMessage(`${created.poNumber} created.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Purchase order could not be created.");
    }
  }

  async function receivePurchaseOrder(item: PurchaseOrder) {
    try {
      const updated = await updatePurchaseOrder(item.id, { status: "RECEIVED", receiveAll: true });
      setPurchaseOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMessage(`${item.poNumber} received and inventory updated.`);
      void load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Purchase order could not be received.");
    }
  }

  async function changePurchaseOrderStatus(item: PurchaseOrder, status: string) {
    if (status === "RECEIVED") return receivePurchaseOrder(item);
    try {
      const updated = await updatePurchaseOrder(item.id, { status });
      setPurchaseOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMessage(`${item.poNumber} moved to ${status.toLowerCase().replace(/_/g, " ")}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Purchase order could not be updated.");
    }
  }

  async function toggleSupplier(item: Supplier) {
    try {
      const updated = await updateSupplier(item.id, { isActive: !item.isActive });
      setSuppliers((current) => current.map((entry) => entry.id === item.id ? updated : entry));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Supplier could not be updated.");
    }
  }

  async function removeSupplier(item: Supplier) {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    try {
      await deleteSupplier(item.id);
      await load();
      setMessage(`${item.name} was removed or archived.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Supplier could not be removed.");
    }
  }

  async function changeRefund(item: Refund, status: Refund["status"]) {
    try {
      const updated = await updateAdminRefund(item.id, { status });
      setRefunds((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      if (updated.returnRequest) {
        setReturns((current) => current.map((entry) =>
          entry.id === updated.returnRequest?.id
            ? { ...entry, status: updated.returnRequest.status, refund: updated }
            : entry
        ));
      }
      setMessage(`Refund for ${item.order.orderNumber} updated.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Refund could not be updated.");
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading fulfillment and supply operations..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Fulfillment and supply"
        title="Operations"
        description="Resolve returns, coordinate suppliers, receive stock, and preserve an auditable inventory trail."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh operations"><RefreshCw size={17} /></button>}
      />
      {message ? <p className="admin-message">{message}</p> : null}

      <nav className="admin-subnav" aria-label="Operations sections">
        <a href="#operations-returns">Returns</a>
        <a href="#operations-supply">Supply</a>
        <a href="#operations-refunds">Refunds</a>
        <a href="#operations-orders">Purchase orders</a>
        <a href="#operations-ledger">Inventory ledger</a>
      </nav>

      <section className="admin-data-panel" id="operations-returns">
        <AdminSectionHeader
          title="Return queue"
          description="Review requested products, record each decision, and restore inventory only after receipt"
        />
        <div className="admin-return-summary">
          <article><span>Needs review</span><strong>{returns.filter((item) => item.status === "REQUESTED").length}</strong></article>
          <article><span>Approved</span><strong>{returns.filter((item) => item.status === "APPROVED").length}</strong></article>
          <article><span>Received</span><strong>{returns.filter((item) => item.status === "RECEIVED").length}</strong></article>
          <article><span>Refund pending</span><strong>{returns.filter((item) => item.status === "REFUND_PENDING").length}</strong></article>
        </div>
        <div className="admin-return-filters" aria-label="Filter returns">
          {["OPEN", "REQUESTED", "APPROVED", "RECEIVED", "REFUND_PENDING", "REFUNDED", "ALL"].map((filter) => (
            <button
              className={returnFilter === filter ? "is-active" : ""}
              type="button"
              key={filter}
              onClick={() => setReturnFilter(filter)}
            >
              {filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="admin-return-workspace">
          <div className="admin-return-queue">
            {filteredReturns.length ? filteredReturns.map((item) => (
              <button
                className={selectedReturn?.id === item.id ? "is-selected" : ""}
                type="button"
                key={item.id}
                onClick={() => selectReturn(item)}
              >
                <span>
                  <strong>{item.returnNumber}</strong>
                  <small>{item.user?.name ?? "Customer"} / {item.order?.orderNumber}</small>
                </span>
                <span>
                  <StatusBadge value={item.status} />
                  <small>{new Date(item.createdAt).toLocaleDateString("en-BD")}</small>
                </span>
              </button>
            )) : <p className="admin-empty-copy">No returns match this filter.</p>}
          </div>
          {selectedReturn ? (
            <aside className="admin-return-review">
              <header>
                <div>
                  <span className="admin-kicker">Return review</span>
                  <h3>{selectedReturn.returnNumber}</h3>
                  <p>{selectedReturn.order?.orderNumber} / {selectedReturn.user?.name ?? "Customer"}</p>
                </div>
                <StatusBadge value={selectedReturn.status} />
              </header>
              <dl>
                <div><dt>Customer email</dt><dd>{selectedReturn.user?.email ?? "Not available"}</dd></div>
                <div><dt>Reason</dt><dd>{selectedReturn.reason}</dd></div>
                <div><dt>Requested</dt><dd>{new Date(selectedReturn.createdAt).toLocaleString("en-BD")}</dd></div>
              </dl>
              {selectedReturn.details ? (
                <div className="admin-return-customer-note">
                  <strong>Customer details</strong>
                  <p>{selectedReturn.details}</p>
                </div>
              ) : null}
              <div className="admin-return-items">
                <strong>Products to return</strong>
                {selectedReturn.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      {item.orderItem?.productName ?? "Ordered product"}
                      {item.orderItem?.variantName ? ` / ${item.orderItem.variantName}` : ""}
                    </span>
                    <span>
                      x{item.quantity}
                      {item.orderItem ? ` / ${formatMoney(item.orderItem.unitPrice * item.quantity)}` : ""}
                    </span>
                    {selectedReturn.status === "APPROVED" ? (
                      <select
                        value={returnDispositions[item.id] ?? ""}
                        aria-label={`Disposition for ${item.orderItem?.productName ?? "return item"}`}
                        onChange={(event) => setReturnDispositions((current) => ({
                          ...current,
                          [item.id]: event.target.value as NonNullable<typeof item.disposition>
                        }))}
                      >
                        <option value="" disabled>Choose disposition</option>
                        <option value="RESTOCK">Restock</option>
                        <option value="INSPECTION">Hold for inspection</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="DISPOSE">Dispose</option>
                      </select>
                    ) : item.disposition ? (
                      <small>{item.disposition.toLowerCase()}</small>
                    ) : null}
                  </div>
                ))}
              </div>
              {selectedReturn.status === "RECEIVED" ? (
                <label className="admin-return-resolution">
                  <span>Resolution</span>
                  <select
                    value={returnResolutionType}
                    onChange={(event) => setReturnResolutionType(
                      event.target.value as NonNullable<ReturnRequest["resolutionType"]>
                    )}
                  >
                    <option value="REFUND">Refund net item value</option>
                    <option value="REPLACEMENT">Replacement arranged</option>
                    <option value="STORE_CREDIT">Store credit issued</option>
                    <option value="NO_ACTION">Close without compensation</option>
                  </select>
                </label>
              ) : null}
              <label className="admin-return-resolution">
                <span>
                  {selectedReturn.status === "REQUESTED" ? "Decision note" : "Resolution and handling note"}
                </span>
                <textarea
                  value={returnResolution}
                  onChange={(event) => setReturnResolution(event.target.value)}
                  placeholder="Add instructions for the customer or an internal resolution note"
                />
                <small>A rejection reason is required and will be visible to the customer.</small>
              </label>
              <div className="admin-return-actions">
                {selectedReturn.status === "REQUESTED" ? (
                  <>
                    <button
                      className="primary-action"
                      type="button"
                      disabled={updatingReturn}
                      onClick={() => void resolveReturn(selectedReturn, "APPROVED")}
                    >
                      <CheckCircle2 size={16} /> Approve return
                    </button>
                    <button
                      className="admin-danger-button"
                      type="button"
                      disabled={updatingReturn}
                      onClick={() => void resolveReturn(selectedReturn, "REJECTED")}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </>
                ) : null}
                {selectedReturn.status === "APPROVED" ? (
                  <button
                    className="primary-action"
                    type="button"
                    disabled={updatingReturn}
                    onClick={() => void resolveReturn(selectedReturn, "RECEIVED")}
                  >
                    <PackageCheck size={16} /> Mark items received
                  </button>
                ) : null}
                {selectedReturn.status === "RECEIVED" ? (
                  returnResolutionType === "REFUND" ? (
                    <button
                      className="primary-action"
                      type="button"
                      disabled={updatingReturn}
                      onClick={() => void resolveReturn(selectedReturn, "REFUND_PENDING")}
                    >
                      <Banknote size={16} /> Create refund
                    </button>
                  ) : (
                    <button
                      className="primary-action"
                      type="button"
                      disabled={updatingReturn}
                      onClick={() => void resolveReturn(selectedReturn, "RESOLVED")}
                    >
                      {returnResolutionType === "REPLACEMENT" ? <Gift size={16} /> : <CheckCircle2 size={16} />}
                      Complete return
                    </button>
                  )
                ) : null}
                {!returnTransitions[selectedReturn.status]?.length ? (
                  <p>This return is closed and remains available for audit.</p>
                ) : null}
              </div>
            </aside>
          ) : (
            <div className="admin-return-review admin-return-empty">
              <RotateCcw size={26} />
              <p>Select a return to review its products and history.</p>
            </div>
          )}
        </div>
      </section>

      <section className="admin-two-column" id="operations-supply">
        <div className="admin-data-panel">
          <AdminSectionHeader title="Suppliers" description="Lead times feed future reorder planning" />
          <div className="admin-compact-list">
            {suppliers.map((supplier) => (
              <article key={supplier.id}>
                <div><strong>{supplier.name}</strong><span>{supplier.contactName || supplier.email || "No contact"}</span></div>
                <small>{supplier.leadTimeDays} day lead time</small>
                <button type="button" onClick={() => setEditingSupplier(supplier)}>Edit</button>
                <button type="button" onClick={() => void toggleSupplier(supplier)}>{supplier.isActive ? "Disable" : "Enable"}</button>
                <button type="button" onClick={() => void removeSupplier(supplier)}>Delete</button>
              </article>
            ))}
          </div>
          <form className="admin-inline-form" onSubmit={addSupplier} key={editingSupplier?.id ?? "new-supplier"}>
            <div className="form-grid">
              <label>Supplier name<input name="name" placeholder="Registered supplier name" defaultValue={editingSupplier?.name ?? ""} required /></label>
              <label>Contact person<input name="contactName" placeholder="Primary contact" defaultValue={editingSupplier?.contactName ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Email address<input name="email" type="email" placeholder="supplier@example.com" defaultValue={editingSupplier?.email ?? ""} /></label>
              <label>Phone number<input name="phone" placeholder="Supplier phone" defaultValue={editingSupplier?.phone ?? ""} /></label>
            </div>
            <label>Lead time in days<input name="leadTimeDays" type="number" min="1" defaultValue={editingSupplier?.leadTimeDays ?? 7} /></label>
            <button className="secondary-action full" type="submit"><Truck size={17} /> {editingSupplier ? "Save supplier" : "Add supplier"}</button>
            {editingSupplier ? <button className="secondary-action full" type="button" onClick={() => setEditingSupplier(null)}>Cancel editing</button> : null}
          </form>
        </div>

        <div className="admin-data-panel">
          <AdminSectionHeader title="Create purchase order" description="This first version supports one line per order" />
          <form className="admin-inline-form" onSubmit={addPurchaseOrder}>
            <label>Supplier<select name="supplierId" defaultValue="" required><option value="" disabled>Select supplier</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>Product<select name="productId" defaultValue="" required><option value="" disabled>Select product</option>{catalog?.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
            <div className="form-grid">
              <label>Order quantity<input name="quantity" type="number" min="1" placeholder="Units to order" required /></label>
              <label>Unit cost<input name="unitCost" type="number" min="0" step="0.01" placeholder="Supplier cost per unit" required /></label>
            </div>
            <label>Expected arrival<input name="expectedAt" type="date" /></label>
            <label>Buying note<textarea name="notes" placeholder="Optional instructions for this purchase" /></label>
            <button className="primary-action full" type="submit"><PackagePlus size={17} /> Create purchase order</button>
          </form>
        </div>
      </section>

      <section className="admin-data-panel" id="operations-refunds">
        <AdminSectionHeader title="Refund queue" description="Completing a refund also marks the related order as refunded." />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Return</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>{refunds.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.order.orderNumber}</strong></td>
                <td>{item.returnRequest?.returnNumber ?? "Order cancellation"}</td>
                <td>{item.order.customerName}<small>{item.order.email}</small></td>
                <td>{formatMoney(item.amount)}</td><td>{item.reason}</td><td>{new Date(item.createdAt).toLocaleDateString("en-BD")}</td>
                <td>
                  {refundTransitions[item.status].length ? (
                    <select value={item.status} onChange={(event) => void changeRefund(item, event.target.value as Refund["status"])}>
                      {[item.status, ...refundTransitions[item.status]].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  ) : <StatusBadge value={item.status} />}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!refunds.length ? <p className="muted-copy">No refunds are waiting.</p> : null}
        </div>
      </section>

      <section className="admin-data-panel" id="operations-orders">
        <AdminSectionHeader title="Purchase orders" description="Receiving all posts stock movements automatically" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>PO</th><th>Supplier</th><th>Items</th><th>Expected</th><th>Cost</th><th>Status</th><th /></tr></thead>
            <tbody>{purchaseOrders.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.poNumber}</strong></td><td>{item.supplier.name}</td><td>{item.items.reduce((sum, line) => sum + line.quantity, 0)}</td>
                <td>{item.expectedAt ? new Date(item.expectedAt).toLocaleDateString("en-BD") : "Not set"}</td>
                <td>{formatMoney(item.totalCost)}</td><td><StatusBadge value={item.status} /></td>
                <td>
                  {item.status !== "RECEIVED" ? (
                    <select value={item.status} onChange={(event) => void changePurchaseOrderStatus(item, event.target.value)}>
                      <option>DRAFT</option><option>ORDERED</option><option>RECEIVED</option><option>CANCELLED</option>
                    </select>
                  ) : "Complete"}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-data-panel" id="operations-ledger">
        <AdminSectionHeader title="Inventory ledger" description="Latest 100 stock changes across sales, returns, receipts, and adjustments" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Time</th><th>Product</th><th>Type</th><th>Quantity</th><th>Reason</th><th>Reference</th></tr></thead>
            <tbody>{movements.map((movement) => (
              <tr key={movement.id}>
                <td>{new Date(movement.createdAt).toLocaleString("en-BD")}</td>
                <td><strong>{movement.product.name}</strong>{movement.variant ? ` · ${movement.variant.name}` : ""}</td>
                <td>{movement.type.replace(/_/g, " ")}</td><td>{movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}</td>
                <td>{movement.reason}</td><td>{movement.reference ?? "Manual"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
