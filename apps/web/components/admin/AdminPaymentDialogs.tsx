"use client";

import { AlertTriangle, ArrowRightLeft, Landmark, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useId, useState } from "react";
import {
  Payment,
  PaymentEvent,
  ReconciliationReport,
  fetchPaymentEvents,
  formatMoney,
  recordManualPayment,
  refundAdminPayment
} from "../../lib/catalog";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const dateTime = (value: string) => new Date(value).toLocaleString("en-BD");

/** Refundable balance is the captured amount less whatever has already settled. */
export function refundableBalance(payment: Payment) {
  return Math.max(0, payment.amount - (payment.refundedAmount ?? 0));
}

/* ------------------------------------------------------------------ Refund -- */

export function RefundPaymentDialog({
  payment,
  onClose,
  onDone
}: {
  payment: Payment;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const formId = useId();
  const balance = refundableBalance(payment);
  // Only bKash can be refunded programmatically today; everything else has to
  // be returned by other means and recorded, and the dialog says so.
  const viaGateway = payment.provider.toLowerCase() === "bkash";
  const [amount, setAmount] = useState(String(balance.toFixed(2)));
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState(!viaGateway);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (value > balance + 0.001) return setError(`Only ${formatMoney(balance)} is refundable.`);
    if (!reason.trim()) return setError("A reason is required — it is stored on the refund record.");

    setSubmitting(true);
    setError("");
    try {
      await refundAdminPayment(payment.id, { amount: value, reason: reason.trim(), manual });
      onDone(
        manual
          ? `Recorded a manual refund of ${formatMoney(value)}.`
          : `Refund of ${formatMoney(value)} sent to ${payment.provider}.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The refund could not be issued.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !submitting && onClose()}
      title={`Refund ${payment.order.orderNumber}`}
      description={`${formatMoney(balance)} of ${formatMoney(payment.amount)} is still refundable on this ${payment.provider} payment.`}
      size="sm"
      icon={<span className="ui-modal__icon-glyph is-danger"><RotateCcw size={19} /></span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form={formId} variant="danger" loading={submitting}>
            {manual ? "Record refund" : "Send refund"}
          </Button>
        </>
      }
    >
      <form className="payment-dialog-form" id={formId} onSubmit={(event) => void submit(event)}>
        <label className="admin-confirm-password-field">
          <span>Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={balance}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>
        <label className="admin-confirm-password-field">
          <span>Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Damaged on arrival"
          />
        </label>

        {viaGateway ? (
          <label className="admin-refund-mode">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            <span>
              <strong>Record only — I refunded the customer elsewhere</strong>
              <small>
                Leave unticked to send the refund to bKash. Ticking it records the refund without
                moving any money.
              </small>
            </span>
          </label>
        ) : (
          <p className="admin-confirm-warning">
            <AlertTriangle size={15} />
            {payment.provider} cannot be refunded automatically. This records a refund you have
            already made by other means.
          </p>
        )}

        {error ? <p className="admin-confirm-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------- Manual capture -- */

export function ManualPaymentDialog({
  onClose,
  onDone
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const formId = useId();
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!orderId.trim()) return setError("Enter the order this payment belongs to.");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");

    setSubmitting(true);
    setError("");
    try {
      await recordManualPayment({
        orderId: orderId.trim(),
        amount: value,
        method: method.trim(),
        reference: reference.trim() || undefined
      });
      onDone(`Recorded ${formatMoney(value)} against the order.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment could not be recorded.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !submitting && onClose()}
      title="Record a manual payment"
      description="For money taken outside a gateway — a bank transfer, or cash collected on delivery."
      size="sm"
      icon={<span className="ui-modal__icon-glyph"><Landmark size={19} /></span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting}>Record payment</Button>
        </>
      }
    >
      <form className="payment-dialog-form" id={formId} onSubmit={(event) => void submit(event)}>
        <label className="admin-confirm-password-field">
          <span>Order number</span>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ORD-1042"
            autoFocus
          />
        </label>
        <label className="admin-confirm-password-field">
          <span>Amount</span>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="admin-confirm-password-field">
          <span>Method</span>
          <input value={method} onChange={(e) => setMethod(e.target.value)} />
        </label>
        <label className="admin-confirm-password-field">
          <span>Reference (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank slip number" />
        </label>
        {error ? <p className="admin-confirm-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Timeline -- */

export function PaymentTimelineDialog({
  payment,
  onClose
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<PaymentEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchPaymentEvents(payment.id)
      .then((result) => active && setEvents(result))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "History unavailable."));
    return () => {
      active = false;
    };
  }, [payment.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`History — ${payment.order.orderNumber}`}
      description="Every transition, reconciliation sweep and refund attempt for this payment."
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {error ? <p className="admin-confirm-error">{error}</p> : null}
      {!events && !error ? <p className="admin-muted">Loading history...</p> : null}
      {events?.length === 0 ? (
        <p className="admin-muted">
          No history recorded. Events are written from the point this payment was created onward.
        </p>
      ) : null}
      {events?.length ? (
        <ol className="payment-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <div className="payment-timeline__head">
                <strong>{event.type}</strong>
                <span className={`payment-timeline__source is-${event.source}`}>{event.source}</span>
                <small>{dateTime(event.createdAt)}</small>
              </div>
              <p>{event.message}</p>
              {event.fromStatus && event.toStatus ? (
                <small className="payment-timeline__transition">
                  {event.fromStatus} <ArrowRightLeft size={11} /> {event.toStatus}
                </small>
              ) : null}
              {event.actor ? <small>by {event.actor.name}</small> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </Modal>
  );
}

/* --------------------------------------------------------- Reconciliation -- */

export function ReconciliationDialog({
  report,
  onClose
}: {
  report: ReconciliationReport;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Reconciliation result"
      description={`Checked ${report.scanned} payment${report.scanned === 1 ? "" : "s"} pending for more than ${report.staleMinutes} minutes.`}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="admin-return-summary">
        <article><span>Scanned</span><strong>{report.scanned}</strong></article>
        <article><span>Corrected</span><strong>{report.corrected}</strong></article>
        <article><span>Unreachable</span><strong>{report.unreachable}</strong></article>
      </div>
      {report.rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Stored</th><th>Gateway</th><th>Outcome</th></tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.paymentId}>
                  <td><strong>{row.orderNumber}</strong><small>{formatMoney(row.amount)}</small></td>
                  <td>{row.storedStatus}</td>
                  <td>{row.gatewayStatus}</td>
                  <td>{row.outcome}{row.detail ? <small>{row.detail}</small> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-muted">
          Nothing needed checking — no payment has been pending longer than the threshold.
        </p>
      )}
    </Modal>
  );
}
