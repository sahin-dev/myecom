"use client";

import {
  Check,
  Copy,
  Download,
  History,
  Landmark,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Trash2
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  Payment,
  ReconciliationReport,
  exportAdminPayments,
  fetchAdminPayments,
  formatMoney,
  permanentlyDeleteAdminResource,
  recheckAdminPayment,
  reconcileAdminPayments
} from "../../lib/catalog";
import {
  ManualPaymentDialog,
  PaymentTimelineDialog,
  ReconciliationDialog,
  RefundPaymentDialog,
  refundableBalance
} from "./AdminPaymentDialogs";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminPageTitle,
  AdminPasswordConfirmDialog,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

const paymentPageSize = 12;
const paymentStatuses = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED"
];

function compactId(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

/** Quotes every field so embedded commas, quotes and newlines survive the round trip. */
function toCsv(rows: Record<string, string | number | boolean>[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [columns.map(cell).join(","), ...rows.map((row) => columns.map((key) => cell(row[key])).join(","))]
    .join("\r\n");
}

function downloadCsv(rows: Record<string, string | number | boolean>[], filename: string) {
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminPayments() {
  const { user } = useAuth();
  const can = useCallback(
    (permission: string) =>
      Boolean(user?.permissions.includes("*") || user?.permissions.includes(permission)),
    [user]
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [page, setPage] = useState(1);
  const [recheckingPaymentId, setRecheckingPaymentId] = useState("");
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Payment | null>(null);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<Payment | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedValue, setCopiedValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { message, kind, notify } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminPayments();
      setPayments(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment records are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function recheckPayment(item: Payment) {
    setRecheckingPaymentId(item.id);
    try {
      const updated = await recheckAdminPayment(item.id);
      setPayments((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      notify(`Payment for ${item.order.orderNumber} is now ${updated.status.toLowerCase().replace(/_/g, " ")}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Payment could not be re-checked.", "error");
    } finally {
      setRecheckingPaymentId("");
    }
  }

  async function permanentlyDeletePayment(password: string) {
    if (!permanentDeleteTarget) return;
    await permanentlyDeleteAdminResource("payments", permanentDeleteTarget.id, password);
    setPayments((current) => current.filter((entry) => entry.id !== permanentDeleteTarget.id));
    notify(`Payment for ${permanentDeleteTarget.order.orderNumber} was permanently deleted.`);
    setPermanentDeleteTarget(null);
  }

  async function runReconciliation() {
    setReconciling(true);
    try {
      const result = await reconcileAdminPayments();
      setReport(result);
      // A sweep can rewrite statuses, so the table has to come back from the server.
      if (result.corrected) await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Reconciliation could not run.", "error");
    } finally {
      setReconciling(false);
    }
  }

  async function exportRecords() {
    setExporting(true);
    try {
      const rows = await exportAdminPayments(status === "ALL" ? undefined : { status });
      if (!rows.length) {
        notify("There is nothing to export for this filter.", "error");
        return;
      }
      downloadCsv(rows, `payments-${new Date().toISOString().slice(0, 10)}.csv`);
      notify(`Exported ${rows.length} payment${rows.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "The export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function copyValue(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      notify(`${label} copied.`);
      window.setTimeout(() => setCopiedValue((current) => current === value ? "" : current), 1600);
    } catch {
      notify(`${label} could not be copied.`, "error");
    }
  }

  function CopyableValue({
    value,
    label,
    children,
    compact = false
  }: {
    value?: string | null;
    label: string;
    children?: ReactNode;
    compact?: boolean;
  }) {
    if (!value) return null;
    const copied = copiedValue === value;
    return (
      <button
        type="button"
        className="admin-copy-value"
        onClick={() => void copyValue(value, label)}
        title={`Copy ${label}`}
      >
        <span>{children ?? (compact ? compactId(value) : value)}</span>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    );
  }

  const providers = useMemo(
    () => [...new Set(payments.map((item) => item.provider).filter(Boolean))].sort(),
    [payments]
  );

  const filteredPayments = useMemo(() => payments.filter((item) => {
    if (status !== "ALL" && item.status !== status) return false;
    if (provider !== "ALL" && item.provider !== provider) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      item.order.orderNumber,
      item.order.customerName,
      item.order.email,
      item.order.userId ?? "",
      item.method,
      item.provider,
      item.transactionId ?? "",
      item.gatewayReference ?? "",
      item.status
    ].join(" ").toLowerCase().includes(query);
  }), [payments, provider, search, status]);

  const summary = useMemo(() => ({
    total: filteredPayments.length,
    paid: filteredPayments.filter((item) => item.status === "PAID").length,
    pending: filteredPayments.filter((item) => ["PENDING", "PARTIALLY_PAID"].includes(item.status)).length,
    failed: filteredPayments.filter((item) => item.status === "FAILED").length,
    amount: filteredPayments.reduce((sum, item) => sum + item.amount, 0),
    refunded: filteredPayments.reduce((sum, item) => sum + (item.refundedAmount ?? 0), 0)
  }), [filteredPayments]);

  const pages = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const pagedPayments = filteredPayments.slice((page - 1) * paymentPageSize, page * paymentPageSize);

  useEffect(() => {
    setPage(1);
  }, [provider, search, status]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  if (loading && !payments.length) return <AdminLoading label="Loading payment transactions..." />;
  if (error && !payments.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Finance"
        title="Payment records"
        description="Review every transaction, gateway reference, payment status, and order connection from one place."
        actions={
          <>
            {can("payments.capture") ? (
              <button className="admin-labeled-action" type="button" onClick={() => setManualOpen(true)}>
                <Landmark size={15} /> Record payment
              </button>
            ) : null}
            {can("payments.reconcile") ? (
              <button
                className="admin-labeled-action"
                type="button"
                onClick={() => void runReconciliation()}
                disabled={reconciling}
              >
                <ScanLine size={15} /> {reconciling ? "Reconciling..." : "Reconcile"}
              </button>
            ) : null}
            {can("payments.export") ? (
              <button
                className="admin-labeled-action"
                type="button"
                onClick={() => void exportRecords()}
                disabled={exporting}
              >
                <Download size={15} /> {exporting ? "Exporting..." : "Export"}
              </button>
            ) : null}
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh payments">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />
      <AdminToast message={message} kind={kind} />

      {timelineTarget ? (
        <PaymentTimelineDialog payment={timelineTarget} onClose={() => setTimelineTarget(null)} />
      ) : null}

      {refundTarget ? (
        <RefundPaymentDialog
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={(text) => {
            setRefundTarget(null);
            notify(text);
            void load();
          }}
        />
      ) : null}

      {manualOpen ? (
        <ManualPaymentDialog
          onClose={() => setManualOpen(false)}
          onDone={(text) => {
            setManualOpen(false);
            notify(text);
            void load();
          }}
        />
      ) : null}

      {report ? <ReconciliationDialog report={report} onClose={() => setReport(null)} /> : null}

      {permanentDeleteTarget ? (
        <AdminPasswordConfirmDialog
          title={`Permanently delete this payment?`}
          body={`This erases the ${formatMoney(permanentDeleteTarget.amount)} ${permanentDeleteTarget.provider} payment for order ${permanentDeleteTarget.order.orderNumber} and any of its refunds, then recalculates the order's payment status.`}
          onCancel={() => setPermanentDeleteTarget(null)}
          onConfirm={permanentlyDeletePayment}
        />
      ) : null}

      <div className="admin-return-summary payment-record-summary">
        <article><span>Matching records</span><strong>{summary.total}</strong></article>
        <article><span>Paid</span><strong>{summary.paid}</strong></article>
        <article><span>Pending</span><strong>{summary.pending}</strong></article>
        <article><span>Failed</span><strong>{summary.failed}</strong></article>
        <article><span>Transaction value</span><strong>{formatMoney(summary.amount)}</strong></article>
        <article><span>Refunded</span><strong>{formatMoney(summary.refunded)}</strong></article>
      </div>

      <section className="admin-data-panel">
        <AdminSectionHeader
          title="Transactions"
          description="Search by order number, customer, transaction ID, gateway reference, method, or provider. Re-check asks the gateway for one pending payment; Reconcile sweeps every stale one. History shows the full audit trail behind a status."
        />
        <form className="admin-filterbar" onSubmit={(event) => event.preventDefault()}>
          <label className="admin-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transaction records"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            {paymentStatuses.map((item) => (
              <option key={item} value={item}>{item.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="ALL">All providers</option>
            {providers.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Created</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>{pagedPayments.map((item) => {
              const canRecheck =
                can("payments.write") &&
                item.status === "PENDING" &&
                item.provider === "bkash" &&
                Boolean(item.gatewayReference);
              const balance = refundableBalance(item);
              // Mirrors PaymentsService.issueRefund: only a captured payment is refundable.
              const canRefund =
                can("payments.refund") &&
                balance > 0 &&
                ["PAID", "PARTIALLY_REFUNDED"].includes(item.status);
              return (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.transactionId ? (
                        <CopyableValue value={item.transactionId} label="transaction ID" compact />
                      ) : item.status === "PENDING" ? "Awaiting gateway transaction" : "No transaction ID"}
                    </strong>
                    <small>
                      {item.gatewayReference ? (
                        <>Gateway: <CopyableValue value={item.gatewayReference} label="gateway reference" compact /></>
                      ) : (
                        <>Payment ID: <CopyableValue value={item.id} label="payment ID" compact /></>
                      )}
                    </small>
                  </td>
                  <td>
                    <strong><CopyableValue value={item.order.orderNumber} label="order number" /></strong>
                    <small>Order total {formatMoney(item.order.total)}</small>
                  </td>
                  <td>
                    {item.order.customerName}
                    <small>
                      {item.order.email}
                      {" / "}
                      {item.order.userId ? (
                        <CopyableValue value={item.order.userId} label="customer ID" compact />
                      ) : "Guest"}
                    </small>
                  </td>
                  <td>{item.method}<small>{item.isManual ? `${item.provider} / recorded manually` : item.provider}</small></td>
                  <td>
                    {formatMoney(item.amount)}
                    <small>
                      {item.refundedAmount > 0
                        ? `${formatMoney(item.refundedAmount)} refunded`
                        : item.failureReason || item.currency}
                    </small>
                  </td>
                  <td>{new Date(item.createdAt).toLocaleString("en-BD")}<small>{item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleString("en-BD")}` : ""}</small></td>
                  <td><StatusBadge value={item.status} kind="payment" /></td>
                  <td>
                    <div className="admin-row-actions">
                        {canRecheck ? (
                          <button type="button" onClick={() => void recheckPayment(item)} disabled={recheckingPaymentId === item.id}>
                            <RefreshCw size={14} /> {recheckingPaymentId === item.id ? "Checking..." : "Re-check"}
                          </button>
                        ) : null}
                        {canRefund ? (
                          <button type="button" onClick={() => setRefundTarget(item)}>
                            <RotateCcw size={14} /> Refund
                          </button>
                        ) : null}
                        <button type="button" title="Payment history" onClick={() => setTimelineTarget(item)}>
                          <History size={14} />
                        </button>
                        {can("payments.permanent_delete") ? (
                          <button type="button" title="Permanently delete" onClick={() => setPermanentDeleteTarget(item)}>
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {!filteredPayments.length ? <p className="muted-copy">No payment records match this filter.</p> : null}
        </div>

        <AdminPagination
          page={page}
          pages={pages}
          total={filteredPayments.length}
          pageSize={paymentPageSize}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
