# Payments Module — Architecture & Admin Review

**Date:** 2026-08-04
**Scope:** `apps/api/src/payments/*`, payment/refund paths in `ecommerce.service.ts` and
`experience.service.ts`, `AdminPayments.tsx`, `AdminOrders.tsx` refund flow, `PaymentGateway` settings.
**Question:** does this meet enterprise-grade expectations, and does it follow standard practice?

---

## Verdict

**Structurally sound, but single-gateway and operationally thin.**

The code is better than typical for a project this size. Several things that are commonly done
wrong here are done right: the strategy pattern isolates gateways cleanly, the webhook doesn't trust
its payload, order payment status is recomputed from payment rows rather than assumed, refund
transitions are guarded by an explicit state machine, and gateway secrets are masked before
reaching the admin client.

What's missing is not correctness so much as **operational surface**: there is no capture/void
model, no gateway-executed refunds, no settlement reconciliation, no payment-level audit trail, and
the admin can view payments but barely act on them.

| Dimension | Grade | Note |
|---|---|---|
| Gateway abstraction | **A−** | Clean strategy pattern; adding a provider is a contained change |
| Webhook handling | **A−** | Re-queries the gateway instead of trusting the payload — the right instinct |
| Status reconciliation | **B+** | Recomputed from payment rows, in a transaction |
| Refund workflow | **B** | Real state machine, over-refund guard — but entirely manual |
| Idempotency | **B−** | Present at order level, absent at payment level |
| Admin capability | **C** | Read-only in practice: view, re-check, delete |
| Audit trail | **C−** | Refunds audited; captures and re-checks are not |
| Multi-gateway / multi-currency | **D** | bKash only; currency hardcoded `BDT` |
| Settlement / finance | **F** | No payout reconciliation, no ledger, no fee capture |

---

## What is done well

**Strategy pattern for gateways** (`payment-strategy.service.ts`). `CheckoutPaymentStrategy` with
cash, bKash, and an explicit `UnsupportedOnlinePaymentStrategy` fallback that fails with a usable
message rather than a crash. Adding Nagad or cards means adding a class, not editing checkout.

**The webhook does not trust its payload** (`payments.controller.ts:120`). It extracts only the
`paymentID`, then calls `queryPayment()` to ask bKash what actually happened. This is why the
missing signature verification is less severe than it first appears — a forged webhook cannot mark
an order paid, because the gateway is the source of truth. That is the correct design instinct.

**Status is derived, not assumed.** `reconcileOrderPaymentStatus()` aggregates paid/pending/failed
payment rows and recomputes the order's status inside a `$transaction`. It handles partial payment
properly, which matters given the advance-payment feature.

**Refund state machine** (`updateRefund`). Explicit `transitions` map, `COMPLETED` is terminal, and
`createManualRefund` blocks over-refunding by summing non-failed refunds against the order total.

**Secrets are masked.** `payment-settings.service.ts:153` returns `"configured"` rather than the
stored `appSecret`/`password`. Correct, and easy to get wrong.

**Token caching with skew.** `grantToken()` caches the bKash token keyed by connection and refreshes
30s early.

---

## Gaps against enterprise practice

### 1. No authorise/capture/void model
Only `PENDING → PAID → FAILED`. Enterprise processors distinguish **authorisation** from **capture**,
which is what lets you reserve funds at checkout and take them at fulfilment, void an unfulfilled
order without a refund round-trip, and capture partially when you ship partially. With the current
model, cancelling a paid order requires a full refund cycle.

### 2. Refunds never reach the gateway
`createManualRefund` writes a `Refund` row and the admin moves it through the state machine by hand.
Nothing calls bKash's refund API. The database says `COMPLETED`; whether money moved is a separate,
manual act. **This is the largest correctness risk in the module** — the records can silently
diverge from reality, and nothing detects it.

### 3. No payment-level idempotency
Orders have `idempotencyKey` (`ecommerce.service.ts:1124`), but `Payment` creation does not. A
retried checkout can produce duplicate `PENDING` rows against one order. `reconcileOrderPaymentStatus`
sums by status, so duplicates distort the derived total.

### 4. No settlement reconciliation
Nothing models what the gateway actually paid out: no fees, no settlement batch, no payout date, no
three-way match between orders, gateway records, and bank deposits. Finance cannot answer "did we
receive what we were owed" from this system. `Payment.amount` is gross; the processor fee is invisible.

### 5. Thin audit trail
`refund.created`, `refund.updated`, and `payment.permanent_delete` are audited. **`requeryPayment`
is not** — an admin can change a payment's status via re-check with no record of who did it or when.
The bKash controller writes no audit entries at all, so gateway-driven transitions are invisible too.

### 6. Single currency
`currency: "BDT"` is hardcoded in `bkash.service.ts:148`; the `Payment.currency` column defaults to
BDT and is never varied. Fine today, a schema-and-logic migration the moment it isn't.

### 7. Unauthenticated `/execute`
`POST /checkout/bkash/execute` has no guard. It's constrained — the `paymentID` must match a stored
`gatewayReference`, and status transitions are checked — so the practical risk is low. But it is
callable by anyone who observes a payment ID, and it triggers an outbound gateway call. Worth rate
limiting at minimum (the platform has no throttler at all, per the earlier audit).

---

## Admin panel assessment

**What an admin can do today:**

| Surface | Capability |
|---|---|
| Payments page | View, search, filter by status/provider, copy IDs, **re-check** a pending bKash payment, **permanently delete** |
| Orders page | Create a manual refund; advance refund status |
| Checkout settings | Configure gateway credentials, mode, priority |

**What's missing that operators expect:**

- **No refund from the payments page.** Refunds live on the Orders screen, so an admin working a
  payments queue must find the order first.
- **No manual payment capture.** A merchant who takes payment out-of-band (bank transfer, cash) has
  no way to record it against an order.
- **No retry / resend payment link** for an abandoned online payment.
- **No reconciliation view** — no "gateway says paid, we say pending" mismatch report. `requeryPayment`
  checks one payment at a time, by hand.
- **No payment timeline.** `providerPayload` holds the raw gateway response but is never surfaced,
  so diagnosing a failure means reading the database.
- **No export.** Finance cannot pull a CSV of transactions for a period.
- **Re-check is narrow.** Guarded to `provider === "bkash"`, status `PENDING`, and non-cancelled
  orders — reasonable, but it means a stuck `FAILED` payment has no recovery path in the UI.

---

## Recommendations, in priority order

**1. Close the refund/gateway gap.** Either call the bKash refund API when a refund moves to
`PROCESSING`, or relabel the current flow as "record a refund made elsewhere" so nobody believes the
system moved money. The present wording implies the former while doing the latter.

**2. Audit every payment mutation.** Add `audit()` to `requeryPayment` and to the gateway-driven
transitions in `payments.controller.ts`. Payment state changes are exactly what an audit log is for,
and refunds already demonstrate the pattern.

**3. Add payment-level idempotency.** A unique key on `(orderId, gatewayReference)` would prevent
duplicate rows outright.

**4. Give the payments page real actions.** Refund inline, record a manual payment, and show the
`providerPayload` timeline. These are small additions to an already-good screen.

**5. Add a reconciliation report.** A scheduled job that re-queries every `PENDING` payment older
than N minutes and flags divergence would catch most real-world payment bugs automatically. This is
the single highest-value addition for operations.

**6. Model settlements when a second gateway lands.** Fees, payout batches, and a three-way match
become necessary the moment finance has to reconcile more than one source.

---

## Summary

The foundations are right — the abstraction is clean, the trust model is correct, and the state
handling is careful. Judged as an early-stage single-gateway integration, this is good work.

Judged against enterprise payment infrastructure, the distance is mostly **operational**: money
movement isn't actually automated for refunds, payment changes aren't fully audited, and the admin
can observe payments far more than manage them. None of those require rearchitecting — they are
additions on top of a sound base.
