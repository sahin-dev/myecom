"use client";

import { CreditCard } from "lucide-react";
import {
  PlatformCheckoutPolicy,
  Product,
  productAdvancePaymentLabel,
  productAdvancePaymentPercent
} from "../lib/catalog";

/**
 * Advance-payment marker for product cards.
 *
 * Shows the figure itself. The previous version was an icon disc with a "%"
 * pip stuck to its corner — a percent sign with no number attached says
 * nothing, and two overlapping circles at 30px read as an artefact rather
 * than a label.
 *
 * Takes the product and policy rather than a prepared string so the five call
 * sites stay one line each and cannot drift apart.
 */
export function AdvancePaymentBadge({
  product,
  policy
}: {
  product: Pick<Product, "checkoutPolicy">;
  policy?: PlatformCheckoutPolicy | null;
}) {
  const label = productAdvancePaymentLabel(product, policy);
  const percent = productAdvancePaymentPercent(product, policy);
  if (!label || !percent) return null;

  return (
    <span className="advance-payment-badge" title={label} aria-label={label}>
      <CreditCard size={12} aria-hidden="true" />
      <b>{percent}%</b>
    </span>
  );
}
