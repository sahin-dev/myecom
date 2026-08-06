# Order management audit — 5 August 2026

Scope: the order lifecycle from placement to delivery, cancellation and return —
`EcommerceService` (orders, status, courier), `ExperienceService` (returns),
`PaymentsService` (money), and the `AdminOrders` screen.

Verdict up front: **the core is genuinely solid and above the level of most
small-shop builds.** There is a real state machine, cancellation compensates
correctly, returns are properly modelled, and order payment status is derived
rather than trusted. It falls short of enterprise-grade in four specific places,
three of which are confirmed defects rather than missing features.

---

## What already meets the standard

| Area | Why it holds up |
|---|---|
| **Status transitions** | `orderTransitions` (`ecommerce.service.ts:160`) is an explicit adjacency map enforced server-side on every write. Illegal jumps are rejected, not silently applied. Cancellation needs a separate `allowCancellation` flag, so it cannot happen by accident through the generic update path. |
| **Cancellation compensation** | Releases inventory per line (variant-aware), writes a `RELEASE` `InventoryMovement` for the audit trail, fails still-pending payments, and reverses `CouponRedemption` rows so a cancelled order's coupon becomes usable again. Most builds forget at least two of these. |
| **Returns** | Its own state machine, per-item dispositions, restock-vs-damage split into distinct `InventoryMovement` types, and a refund amount that allocates the order discount proportionally and caps at `order.total − completed refunds` (`experience.service.ts:1151-1167`). This is careful work. |
| **Courier layer** | `CourierShipment` + normalised `CourierShipmentEvent`, provider payloads retained, `lastSyncedAt`, and an effective-status fallback that reads through to the last known event when the shipment itself is `UNKNOWN`. |
| **Payment status** | Derived from payment and refund rows through a single implementation, so a corrected payment always drags the order back into agreement. |
| **List performance** | Server-side pagination, filtering and search with a bounded page size. |
| **Admin surface** | Bulk status apply, CSV export, packing-slip print, manual order creation, courier dispatch/sync, payment ledger, tracking history. |

---

## Confirmed defects

### 1. The order editor's "Payment status" control does nothing — *verified*

`AdminOrders.tsx:1117` renders a payment-status `<select>`; `adminUpdateOrder`
writes it, then returns `this.adminOrder(...)`, which re-derives payment status
from the payment rows and overwrites the admin's choice in the same request.

Probed against the real database:

```
after the admin's write        : PAID
after adminOrder() re-derives  : PENDING
```

The admin picks "Paid", saves, and the field silently reverts. This is
the worst kind of bug in an ops tool: it looks like it worked.

**Fix:** remove the control. Payment status is derived by design — the correct
way to make an order paid is *Record manual payment* in the payment ledger,
which is already built and already sits on the same screen.

### 2. Cancelling a paid order creates a refund that never moves money

`updateOrderStatus` (`ecommerce.service.ts:1643`) writes a raw `Refund` row with
`status: "PENDING"` directly, bypassing `PaymentsService.issueRefund`. So:

- no `PaymentEvent` is recorded, so the refund is invisible in the payment timeline;
- `payment.refundedAmount` is never incremented, so the refundable balance stays
  at full value and the same money can be refunded twice;
- nothing is ever sent to bKash — the row is a to-do note that looks like a refund;
- the whole amount is attributed to `paidPayments[0]` even when the order has
  several payments.

This is precisely the divergence class the payments work was meant to eliminate;
this call site was missed.

**Fix:** route it through `paymentsService.issueRefund({ manual: true, … })` per
paid payment, or leave the money captured and let staff refund deliberately from
the payments screen. The second is arguably more correct — an auto-refund on
cancel is a policy decision, not a mechanic.

### 3. Cancellation is unattributed

`adminCancelOrder` (`ecommerce.controller.ts:267`) takes no `actorId` and
`updateOrderStatus` writes no `AuditLog`. The most consequential non-delete
action in the system records *what* happened but never *who*. Every other
destructive route in this codebase passes `request.user.id`.

**Fix:** thread `actorId` through `updateOrderStatus` and write an audit row
inside the existing transaction.

*(A fourth defect — `permanentlyDeleteOrder` orphaning `PaymentEvent` rows —
was found and fixed during this audit.)*

---

## Gaps against enterprise-grade

Ordered by how much they'd actually hurt.

**1. Customer notifications are written but never sent.** `Notification` rows are
created on every status change, but `MailService` is wired only into
`auth.service.ts`. No customer receives an order confirmation, a dispatch notice,
or a delivery update. For an e-commerce order system this is the single biggest
functional gap — it drives the support load that the rest of the tool then has to
absorb.

**2. No ageing or SLA view.** There is no way to ask "which orders have sat in
CONFIRMED for more than 24 hours?" Ops teams work from an exception queue, not a
reverse-chronological list. This is the highest-value *addition* on the list and
is cheap: `createdAt`/status are already indexed-adjacent, and the summary strip
on the orders page is the natural home.

**3. No post-placement order editing.** Items, quantities, and the shipping
address are frozen once placed. Real fulfilment needs to swap an out-of-stock
line, fix a mistyped address, or adjust a quantity — otherwise staff cancel and
re-create, which loses the order history and the payment.

**4. No partial fulfilment.** `OrderItem` has no fulfilled/shipped quantity, and
an order maps to one status. Multi-parcel or backordered shipments cannot be
represented, even though `CourierShipment` is already a one-to-many.

**5. Terminal states are dead ends.** `DELIVERY_FAILED` can only go back to
`OUT_FOR_DELIVERY` — there is no return-to-origin path, so a parcel that comes
back to the warehouse has nowhere to land. `SHIPPED` cannot be cancelled at all,
which is right for most cases but leaves RTO unrepresentable.

**6. No admin activity trail on the order.** `TrackingEvent` is the
customer-facing status history. Admin actions — refunds, dispatches, edits — go
to `AuditLog`, which the order view never shows. Staff cannot see who did what to
an order without database access. (The payment timeline built last session is the
pattern to copy.)

**7. No risk signals.** No duplicate-order detection, no address validation, no
flag for a high-value first-time COD order — the classic loss vector for
cash-on-delivery markets.

---

## Recommendation

The architecture is right; it does not need rework. In priority order:

1. Fix defects 1–3 above (small, contained, all in existing code paths).
2. Wire `MailService` into order status changes.
3. Add an ageing/SLA exception view to the orders page.
4. Then consider order editing and partial fulfilment — both are real features
   with schema implications and deserve their own design pass.

Items 5–7 are worth tracking but are not what separates this from an
enterprise-grade system today.
