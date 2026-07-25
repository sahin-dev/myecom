"use client";

import { PackagePlus, RefreshCw, RotateCcw, Truck } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
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
  RECEIVED: ["RESOLVED"],
  REJECTED: [],
  CANCELLED: [],
  RESOLVED: []
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

  async function resolveReturn(item: ReturnRequest, status: string) {
    try {
      const updated = await updateAdminReturn(item.id, { status });
      setReturns((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMessage(`${item.returnNumber} updated.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Return could not be updated.");
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

      <section className="admin-data-panel">
        <AdminSectionHeader title="Return queue" description="Receiving a return can restore the approved quantity to inventory" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Return</th><th>Customer</th><th>Order</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{returns.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.returnNumber}</strong></td><td>{item.user?.name ?? "Customer"}</td>
                <td>{item.order?.orderNumber}</td><td>{item.reason}</td><td><StatusBadge value={item.status} /></td>
                <td>
                  <select value={item.status} onChange={(event) => void resolveReturn(item, event.target.value)}>
                    {[item.status, ...(returnTransitions[item.status] ?? [])].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-two-column">
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
            <div className="form-grid"><input name="name" placeholder="Supplier name" defaultValue={editingSupplier?.name ?? ""} required /><input name="contactName" placeholder="Contact" defaultValue={editingSupplier?.contactName ?? ""} /></div>
            <div className="form-grid"><input name="email" type="email" placeholder="Email" defaultValue={editingSupplier?.email ?? ""} /><input name="phone" placeholder="Phone" defaultValue={editingSupplier?.phone ?? ""} /></div>
            <input name="leadTimeDays" type="number" min="1" defaultValue={editingSupplier?.leadTimeDays ?? 7} />
            <button className="secondary-action full" type="submit"><Truck size={17} /> {editingSupplier ? "Save supplier" : "Add supplier"}</button>
            {editingSupplier ? <button className="secondary-action full" type="button" onClick={() => setEditingSupplier(null)}>Cancel editing</button> : null}
          </form>
        </div>

        <div className="admin-data-panel">
          <AdminSectionHeader title="Create purchase order" description="This first version supports one line per order" />
          <form className="admin-inline-form" onSubmit={addPurchaseOrder}>
            <select name="supplierId" defaultValue="" required><option value="" disabled>Select supplier</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select>
            <select name="productId" defaultValue="" required><option value="" disabled>Select product</option>{catalog?.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select>
            <div className="form-grid"><input name="quantity" type="number" min="1" placeholder="Quantity" required /><input name="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" required /></div>
            <input name="expectedAt" type="date" />
            <textarea name="notes" placeholder="Buying note" />
            <button className="primary-action full" type="submit"><PackagePlus size={17} /> Create purchase order</button>
          </form>
        </div>
      </section>

      <section className="admin-data-panel">
        <AdminSectionHeader title="Refund queue" description="Completing a refund also marks the related order as refunded." />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>{refunds.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.order.orderNumber}</strong></td><td>{item.order.customerName}<small>{item.order.email}</small></td>
                <td>{formatMoney(item.amount)}</td><td>{item.reason}</td><td>{new Date(item.createdAt).toLocaleDateString("en-BD")}</td>
                <td><select value={item.status} onChange={(event) => void changeRefund(item, event.target.value as Refund["status"])}><option>PENDING</option><option>PROCESSING</option><option>COMPLETED</option><option>FAILED</option></select></td>
              </tr>
            ))}</tbody>
          </table>
          {!refunds.length ? <p className="muted-copy">No refunds are waiting.</p> : null}
        </div>
      </section>

      <section className="admin-data-panel">
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

      <section className="admin-data-panel">
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
