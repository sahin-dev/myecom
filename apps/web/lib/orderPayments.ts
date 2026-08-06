import type { Order } from "./catalog";

const capturedStatuses = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

export function orderPaymentBreakdown(order: Order) {
  const scheduledNow = Math.max(order.amountDueNow ?? 0, 0);
  const scheduledOnDelivery = Math.max(
    order.amountDueOnDelivery ?? order.total - scheduledNow,
    0
  );
  const payments = order.payments ?? [];
  const refunds = order.refunds ?? [];
  const capturedAmount = payments
    .filter((payment) => capturedStatuses.has(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const refundedAmount = refunds
    .filter((refund) => refund.status === "COMPLETED")
    .reduce((sum, refund) => sum + refund.amount, 0);
  const paidAmount = Math.min(order.total, Math.max(0, capturedAmount - refundedAmount));
  const failedAmount = payments
    .filter((payment) => payment.status === "FAILED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingAmount = payments
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingAmount = Math.max(order.total - paidAmount, 0);
  const hasFailedPayment = failedAmount > 0 && outstandingAmount > 0;
  const shouldShowPaymentPlan =
    scheduledNow > 0 || paidAmount > 0 || failedAmount > 0 || pendingAmount > 0 || refundedAmount > 0;

  return {
    scheduledNow,
    scheduledOnDelivery,
    paidAmount,
    refundedAmount,
    failedAmount,
    pendingAmount,
    outstandingAmount,
    hasFailedPayment,
    shouldShowPaymentPlan
  };
}
