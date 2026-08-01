import type { Order } from "./catalog";

const capturedStatuses = new Set(["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);

export function orderPaymentBreakdown(order: Order) {
  const scheduledNow = Math.max(order.amountDueNow ?? 0, 0);
  const scheduledOnDelivery = Math.max(
    order.amountDueOnDelivery ?? order.total - scheduledNow,
    0
  );
  const payments = order.payments ?? [];
  const paidAmount = Math.min(
    order.total,
    payments
      .filter((payment) => capturedStatuses.has(payment.status))
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const failedAmount = payments
    .filter((payment) => payment.status === "FAILED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingAmount = payments
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingAmount = Math.max(order.total - paidAmount, 0);
  const hasFailedPayment = failedAmount > 0 && outstandingAmount > 0;
  const shouldShowPaymentPlan =
    scheduledNow > 0 || paidAmount > 0 || failedAmount > 0 || pendingAmount > 0;

  return {
    scheduledNow,
    scheduledOnDelivery,
    paidAmount,
    failedAmount,
    pendingAmount,
    outstandingAmount,
    hasFailedPayment,
    shouldShowPaymentPlan
  };
}
