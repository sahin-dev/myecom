# Product & Platform Audit — Storefront, Admin, Design System

**Date:** 2026-08-02 · **Scope:** `apps/web` (storefront + admin console), `apps/api` (NestJS + Prisma/MongoDB)
**Goal:** a professional, modern, minimalist, enterprise-grade product — and the usability + scalability foundations that hold it up.

---

## 1. Executive summary

The domain model here is genuinely strong. 45 Prisma models cover orders, returns, refunds, purchase orders, couriers, promotions, RBAC with a permission catalogue, audit logging, and first-party analytics. That is a wider commerce surface than most projects at this stage, and the admin console already has real product thinking in it — a Ctrl+K command palette, permission-gated navigation, grouped IA, a decision-oriented overview.

**The gap is not features. It is foundations.** Three things stand between the current build and "enterprise-grade":

1. **There is no design system** — only a 19,478-line stylesheet with 80 distinct font sizes and 194 distinct padding values. Visual consistency is currently maintained by hand, which does not scale and is the root cause of the "not quite premium" feel.
2. **The platform has no safety rails** — zero tests, no CI, no rate limiting, no security headers, no error tracking. Any change is a manual-QA change.
3. **Several core paths will not survive growth** — the admin dashboard loads every order and every product into memory on each request; search is an unindexed regex scan; only 9 database indexes exist across 45 models.

Fix those three and the product becomes genuinely enterprise-grade. The feature roadmap in §7 is the upside on top.

### Scorecard

| Area | Grade | One-line verdict |
|---|---|---|
| Domain model & data richness | **A−** | Broad, well-considered, ahead of the UI that surfaces it |
| Admin IA & information design | **B** | Strong bones (command palette, RBAC nav); flat routing and density issues |
| Storefront UX | **B−** | Complete journeys; weak on performance primitives and SEO surface |
| **Design system** | **D** | Tokens exist but are bypassed; no scale, no dark mode, no primitives |
| Accessibility | **C−** | ARIA labels present; no focus management, type far below minimums |
| API architecture | **C+** | Clean Nest/Prisma patterns, but god-services and no caching layer |
| **Security posture** | **D+** | Solid RBAC + scrypt; no rate limiting, headers, or upload hardening |
| **Scalability** | **D** | Unbounded queries, 9 indexes, no cache, local-disk uploads |
| **Engineering safety net** | **F** | No tests, no CI, no linting, no error tracking |

---

## 2. The design system — the highest-leverage fix

This is the single change that most affects whether the product *reads* as enterprise-grade.

### What was measured in `apps/web/app/globals.css`

> **Status 2026-08-03 — Phase 1 items 1 & 2 are implemented.** The "After" column
> is the measured result. See §10 for what shipped and what is still outstanding.

| Metric | Before | After | Enterprise target |
|---|---|---|---|
| Design tokens defined | 30 custom properties | **184** | 120–200 across 6 scales |
| Hardcoded hex occurrences | 198 (97 distinct) | **6** (brand marks only) | 0 outside the token layer |
| Distinct `font-size` values | **80** | **36** (26 raw, all fluid display type) | 7–9 type steps |
| Declarations below 11px | ~270 | **0** | 0 |
| Dark mode | none | **shipped** | required |
| Density modes | none | **shipped** | required |
| Component primitives | 0 | **9** | 10–15 |
| Distinct `border-radius` values | **21** | 21 *(not yet migrated)* | 4–5 |
| Distinct `padding` values | **194** | 194 *(not yet migrated)* | An 8pt scale (~10 steps) |
| `!important` declarations | 25 | 25 *(not yet migrated)* | 0 |

The interpretation: a token layer was started (`--accent`, `--paper`, `--admin-line`…) and then routinely bypassed. Every new component introduced its own sizes and colors. That is why the UI looks *close to* consistent but never crisp — the eye picks up 11px next to 10.5px next to 12px.

### The type-size problem specifically

The most-used sizes in the admin are **11px (121×), 12px (104×), 10px (76×), 9px (50×), 8px (21×)**.

Roughly 270 declarations set text at **11px or smaller**. Enterprise dashboards (Linear, Stripe, Vercel, Retool) run 13–14px body with 12px as the *smallest* supporting size. Sub-10px type is why the console reads as cramped rather than dense-and-confident, and 8–9px labels are a genuine accessibility failure, not just a taste issue.

**Density is achieved through spacing and hierarchy, not through shrinking text.**

### Recommended token architecture

Replace the ad-hoc variables with a real scale. Split `globals.css` into:

```
styles/
  tokens.css       ← primitives: color ramps, space, type, radius, shadow, motion
  semantic.css     ← roles: --surface-raised, --text-secondary, --border-subtle …
  base.css         ← reset + element defaults
  components/…     ← one file per component family
```

Concrete starting scales:

```css
:root {
  /* Type — 8 steps, 13px body */
  --text-2xs: 11px;  --text-xs: 12px;  --text-sm: 13px;  --text-base: 14px;
  --text-lg: 16px;   --text-xl: 20px;  --text-2xl: 26px; --text-3xl: 34px;

  /* Space — 8pt scale */
  --space-1: 4px;  --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 24px; --space-6: 32px;  --space-7: 48px;  --space-8: 64px;

  /* Radius — 5 steps */
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;
  --radius-xl: 16px; --radius-full: 999px;

  /* Elevation — 4 steps, not 20 shadows */
  --elevation-1: 0 1px 2px rgb(24 18 12 / .06);
  --elevation-2: 0 4px 12px rgb(24 18 12 / .08);
  --elevation-3: 0 12px 32px rgb(24 18 12 / .12);
  --elevation-4: 0 24px 64px rgb(24 18 12 / .16);
}
```

Then add semantic roles on top (`--text-primary`, `--surface-sunken`, `--border-strong`, `--status-success-bg`…) so a dark theme is a matter of re-pointing roles, not rewriting components.

### Missing design capabilities

- **Dark mode** — nothing exists. `prefers-color-scheme` appears zero times. This is table-stakes for an admin tool people stare at all day.
- **Density modes** — comfortable/compact toggle, the standard answer to "power users want more rows on screen."
- **Motion tokens** — transitions are inconsistent; define `--duration-fast/base/slow` and one or two easing curves, and honour `prefers-reduced-motion`.
- **Focus-visible system** — a single consistent focus ring token, applied globally.
- **Component primitives** — there is no `Button`, `Input`, `Select`, `Card`, `Badge`, `Table`, `Drawer`, or `Tooltip` component. Every screen re-implements `.primary-action` / `.secondary-action` / `.danger-action` by hand. A dozen shared primitives would remove thousands of CSS lines and make consistency automatic rather than aspirational.

---

## 3. Admin console

### What is already good

- Ctrl+K command palette, grouped navigation, permission-filtered menu (`AdminConsole.tsx:143-159`)
- Genuine RBAC with a permission catalogue and custom roles (`apps/api/src/auth/permissions.ts`)
- Audit logging built into service methods
- The overview page is decision-oriented rather than vanity-metric-oriented

### Structural issues

**Single-route architecture.** The whole console is `/admin?tab=x` with `window.history.pushState` (`AdminConsole.tsx:108-117`), and all 12 modules are eagerly imported (`AdminConsole.tsx:26-37`).

Consequences: no deep links to a specific order or product; every admin visit downloads all 12 modules (~10,000 lines of TSX) before rendering anything; no per-route loading or error boundaries.

**Fix:** move to real Next.js routes — `/admin/orders/[id]`, `/admin/products/[id]` — with `next/dynamic` per section. This gives code-splitting, shareable URLs, and proper back/forward for free.

**Command palette is navigation-only.** It searches section names, not records. In enterprise tools Ctrl+K finds *the order*, *the customer*, *the product*, and offers actions ("mark as shipped"). This is a high-visibility, moderate-effort upgrade.

### Missing admin capabilities (ranked by day-to-day value)

| Capability | Why it matters |
|---|---|
| **Saved views / filter presets** | "Unfulfilled + paid + this week" is retyped dozens of times a day |
| **Global record search** | Currently must know which tab a record lives in |
| **Bulk actions everywhere** | Only products have bulk archive; orders/payments/customers have none |
| **Notification centre + real-time** | No in-admin alerting; new orders require a manual refresh |
| **Audit log UI** | `AuditLog` is written to but barely surfaced — compliance value is unrealised |
| **Export beyond orders** | Only orders export to CSV; every table should export |
| **Inline/optimistic editing** | Every edit is a full form round-trip |
| **Undo for destructive actions** | Especially now that permanent delete exists |
| **Column customisation** | Choose/reorder/resize columns per table |
| **Keyboard navigation in tables** | `j/k` row movement, `Enter` to open, `x` to select |
| **Empty & error states per module** | Inconsistent today; several modules render blank |
| **Onboarding checklist** | New store setup has no guided path |

### Accessibility gaps in the admin

- **No focus trap, no Escape-to-close, no focus restore** in any modal (`AdminShared.tsx`, `AuthGateModal.tsx`). Keyboard users can tab out of an open dialog into the page behind it.
- Only 5 `aria-live` regions across the whole app — async results are largely unannounced.
- Type below 12px throughout, as covered above.
- Colour-only status signalling in several tables.

---

## 4. Storefront

### Performance

- **`next/image` is used in exactly one file** (`Storefront.tsx`). Everywhere else uses raw `<img>` — no responsive `srcset`, no lazy loading, no AVIF/WebP negotiation, no width/height reservation (CLS). `next.config.mjs` already configures AVIF/WebP and remote patterns; the config is there, the usage is not.
- **Everything is `force-dynamic` + `cache: "no-store"`** (`app/page.tsx:6,11`, `app/[info]/page.tsx:16,21`). The homepage and catalog re-fetch on every single request with no ISR, no `revalidateTag`, no CDN caching. This is the storefront's biggest scaling cost and the easiest win: product and content pages should be ISR with tag-based invalidation on admin write.
- No bundle analysis, no route-level `loading.tsx` skeletons.

### SEO surface

Missing entirely: `sitemap.ts`, `robots.ts`, `manifest.ts`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx`.

Also absent: **JSON-LD structured data** (`Product`, `Offer`, `AggregateRating`, `BreadcrumbList`, `Organization`) — this is what drives rich results for a commerce site and is a few hours of work. Canonical URLs are set on the homepage only.

### Storefront feature gaps

Product comparison · recently viewed · "customers also bought" / recommendations · back-in-stock notification UI (the `StockAlert` model exists, unused) · product Q&A · guest order lookup by email+order number · size/variant guides · social proof ("12 sold today") · exit-intent / abandoned-cart recovery · multi-currency · i18n (Bangla) · PWA/offline · Web Vitals monitoring.

---

## 5. Platform, performance & scalability

### Critical: unbounded queries

`ecommerce.service.ts:1659-1677` (admin dashboard) executes:

```ts
this.prisma.order.findMany({ select: {…} })          // EVERY order, no where, no take
this.prisma.product.findMany({ include: {…} })       // EVERY product
this.prisma.order.findMany({ where: {…period},
  include: { items: true, trackingEvents: true } })   // full period with all relations
```

…then aggregates in JavaScript (`:1687-1760`). At a few thousand orders this is slow; at tens of thousands it will time out or exhaust memory. **This is the most urgent scalability defect.**

**Fix:** push aggregation into the database (`groupBy`/`aggregate`, or a MongoDB aggregation pipeline), and precompute daily rollups into a `DailyMetric` collection for trend and comparison periods.

### Critical: index coverage

Only **9 `@@index` declarations across 45 models.** Unindexed models include `Order`, `OrderItem`, `Product`, `Review`, `AnalyticsEvent`, `AuditLog`, `Notification`, `User`.

Every admin order filter (`status`, `paymentStatus`, `createdAt`, `email`) is a collection scan. Minimum additions:

```prisma
// Order
@@index([status]) @@index([paymentStatus]) @@index([createdAt]) @@index([email]) @@index([userId])
// OrderItem
@@index([orderId]) @@index([productId])
// Product
@@index([status]) @@index([categoryId]) @@index([brandId]) @@index([isCombo, showOnHome])
// AnalyticsEvent
@@index([type, createdAt]) @@index([createdAt])
// AuditLog
@@index([createdAt]) @@index([entity, entityId])
```

### Search

All search is Prisma `contains` + `mode: "insensitive"` (`ecommerce.service.ts:341,2006,2401,2454`) — an unanchored regex scan per query, with no relevance ranking, typo tolerance, synonyms, or faceting.

**Fix path:** MongoDB Atlas Search (no new infrastructure) or Meilisearch/Typesense (better relevance, more control).

### Missing infrastructure

| Missing | Impact |
|---|---|
| **Caching layer (Redis)** | Every request hits Mongo; no session/cart/catalog cache |
| **Background jobs (BullMQ)** | Email, courier sync, exports, webhooks all run inline in the request |
| **Rate limiting** (`@nestjs/throttler`) | Login is brute-forceable; no abuse protection anywhere |
| **Security headers** (`helmet`) | No CSP, HSTS, X-Frame-Options |
| **Structured logging** (pino) | No request IDs, no correlation, no log levels |
| **Error tracking** (Sentry) | Production failures are invisible |
| **API docs** (`@nestjs/swagger`) | No contract for consumers or future mobile app |
| **Object storage** (S3/R2) | Uploads on local disk (`main.ts:26`) prevent horizontal scaling |
| **Health/readiness endpoints** | No `/health` for orchestration |
| **DB migrations discipline** | Mongo + `db push` means no reviewable schema history |

### Security specifics

- **No rate limiting on `/auth/login`** — unlimited password attempts. Add throttling + account lockout + optional CAPTCHA.
- **Upload validation trusts the client MIME header** (`uploads.controller.ts:48-53`). No magic-byte sniffing, no re-encoding. A crafted file with `Content-Type: image/png` is accepted and served from your origin.
- **No CSRF protection** — mitigated by Bearer tokens today, but the token lives in `localStorage` (`catalog.ts:1625`), which is XSS-readable. httpOnly cookies + CSRF tokens is the stronger posture.
- No 2FA for admin accounts; no session management/revocation; no password strength policy beyond `MinLength(8)`.

**Good:** scrypt with `timingSafeEqual` (`auth/password.ts`) is a correct, well-chosen implementation. RBAC enforcement via `AdminGuard` + `@RequirePermission` is consistently applied.

### Code architecture

- `ecommerce.service.ts` is **2,887 lines**; `experience.service.ts` is **2,214**. These are god-services mixing catalog, orders, checkout, analytics, and content.
- `lib/catalog.ts` is **2,778 lines** — every type, every API call, and seed fallback data in one module.
- Everything lives in a **single flat `AppModule`** — no feature modules, so no clear boundaries or lazy loading.
- **No data-fetching library.** Every component hand-rolls `loading`/`error`/`refetch` state. TanStack Query would remove hundreds of lines and add caching, dedupe, and background refresh.
- **No form library.** Forms are raw `FormData` parsing with no schema validation; validation errors are server-round-trip only.

---

## 6. Notable functional gap: transactional email

`mail.send()` is called in **exactly one place** — password reset (`auth.service.ts:178`).

There is no order confirmation, no payment receipt, no shipping notification, no delivery confirmation, no refund notice, no return status update. The `Notification` model provides in-app messages, but customers who do not return to the site receive nothing.

For a commerce product this is the most conspicuous missing capability, and it depends on the background-job infrastructure above.

---

## 7. Recommended roadmap

### Phase 1 — Foundations (highest leverage)

1. **Design token system + split `globals.css`** into layered files; adopt the 8-step type scale (13px body) and 8pt spacing scale.
2. **Build ~12 component primitives** (Button, Input, Select, Card, Badge, Table, Modal, Drawer, Tooltip, Tabs, Toast, EmptyState) and migrate screens onto them.
3. **Add the safety net:** Vitest + Playwright, ESLint + Prettier, GitHub Actions running typecheck/lint/test on PRs.
4. **Fix the dashboard queries** and add the index set from §5.
5. **Security baseline:** `helmet`, `@nestjs/throttler`, login lockout, magic-byte upload validation.

### Phase 2 — Product quality

6. **Dark mode + density toggle** (nearly free once tokens exist).
7. **Modal accessibility:** focus trap, Escape, focus restore, `aria-live` for async results.
8. **Storefront performance:** migrate to `next/image`, adopt ISR + `revalidateTag`, add `loading.tsx`/`error.tsx`.
9. **SEO surface:** `sitemap.ts`, `robots.ts`, JSON-LD structured data, canonical URLs.
10. **Admin routing:** real routes per section with `next/dynamic` code-splitting.

### Phase 3 — Scale & operations

11. **Redis cache + BullMQ jobs**, then **full transactional email** on top.
12. **Proper search** (Atlas Search or Meilisearch) with facets.
13. **Object storage** for uploads; add `/health`; structured logging + Sentry.
14. **Split god-services** into feature modules; introduce TanStack Query on the client.

### Phase 4 — Differentiation

15. Global record search in Ctrl+K, saved views, bulk actions, column customisation.
16. Real-time admin notifications (SSE/WebSocket).
17. Abandoned-cart recovery, recommendations, back-in-stock UI.
18. Tax engine, multi-currency, i18n (Bangla), category hierarchy.
19. Customer segments (RFM), cohort retention, marketing automation.
20. Outbound webhooks + public API for integrations.

---

## 8. Domain-model additions worth planning for

Not needed immediately, but each is currently unrepresentable:

`TaxRate` / `TaxZone` · `Category.parentId` (hierarchy) · `Currency` / `ExchangeRate` · `GiftCard` / `StoreCredit` · `LoyaltyAccount` · `Subscription` (recurring orders) · `Webhook` / `WebhookDelivery` · `EmailTemplate` · `Media` (asset library with alt text and usage tracking) · `Location` / `StockByLocation` (multi-warehouse) · `ProductQuestion` · `SavedView` · `DailyMetric` (rollups) · `Session` (revocable admin sessions).

---

## 9. Where to start

If only one thing happens this quarter, make it **Phase 1, items 1–2**: the token system and the component primitives.

Every subsequent visual change gets cheaper and more consistent, dark mode becomes a config change rather than a project, and the product stops looking like a capable app and starts looking like an enterprise product. Items 3–5 are what let you ship those changes without fear.

---

## 10. Implementation log — design system (2026-08-03)

### Shipped

**Token architecture** — `apps/web/app/styles/`

| File | Role |
|---|---|
| `tokens.css` | Primitives: 6 colour ramps (warm neutral, sand, blue, green, amber, red), 9-step type scale, 4pt space scale, 6 radii, 4 elevations, motion, z-index, breakpoints |
| `semantic.css` | Intent roles (`--surface-raised`, `--text-secondary`, `--border-subtle`, status sets), the full dark theme, two density modes, and one global focus system |
| `primitives.css` | The `ui-` component layer |

**The compatibility bridge.** Rather than rewrite 19k lines, the original palette
variables in `globals.css` were re-pointed at semantic roles:

```css
--paper:      var(--surface-raised);
--accent:     var(--text-primary);
--accent-12:  var(--border-subtle);
--accent-55:  var(--text-secondary);
```

Every existing rule that consumed those aliases now themes automatically. This is
why dark mode reaches the whole application without touching individual screens.

**Colour tokenisation** — 198 hardcoded hex occurrences reduced to 6. The
survivors are deliberate: three payment-brand marks (bKash, Nagad, a brand gold)
and `color: #fff` on solid coloured fills, which is correct in both themes.

**Type normalisation** — every UI font size now references the scale. Nothing
renders below 11px any more (previously ~270 declarations did, some at 8px). The
26 remaining raw values are all `clamp()` fluid display type on storefront
marketing headings, which is the right tool for that job.

**Dark mode** — `data-theme` on `<html>`, resolved before first paint by an
inline boot script (`ThemeContext.tsx`), so there is no light flash. Supports
light / dark / system with `localStorage` persistence. Shadows are re-tuned for
dark: depth comes from surface steps rather than shadow, which is what reads as
premium instead of muddy.

**Density modes** — comfortable (default) and compact, re-declaring the three
smallest type steps plus control heights and table padding. This is the standard
answer to "power users want more rows on screen" without shrinking type globally.

**Component primitives** — `apps/web/components/ui/`

`Button` (4 variants × 3 sizes, loading, icon-only) · `Field` / `Input` /
`Select` / `Textarea` / `TextField` · `Modal` · `Card` / `CardHeader` · `Badge`
(6 tones) · `EmptyState` · `Skeleton` · `VisuallyHidden`

`Modal` closes the accessibility gap identified in §3: focus moves in on open, is
trapped while open, and is restored to the trigger on close; Escape dismisses;
background scroll locks. `Field` wires `for`/`id`, `aria-describedby` for hint
*and* error, and `aria-invalid` automatically.

**Global focus system + reduced motion** — one consistent keyboard-only focus
ring, and `prefers-reduced-motion` now zeroes the motion tokens and neutralises
animation app-wide.

**Admin appearance controls** — theme and density switchers in the topbar
(`AdminAppearance.tsx`).

### Verified

`tsc --noEmit` clean on `apps/web`; `next build` completes all 14 routes; both
CSS layers confirmed present and correctly ordered in the served HTML, with the
dark-theme and compact-density blocks intact in the production bundle.

**Not verified:** rendered appearance. There is no browser in the working
environment, so the light-mode visual diff (from type sizes moving up a step) and
the dark-mode result have not been seen. Both need a human pass with `pnpm dev`.

### Contrast remediation (same day)

The first token pass converted hex colours but missed the `white` / `black`
**keywords**, which is what produced the reported text/background conflicts. A
resolver was written to walk the custom-property chain for both themes and score
every rule's own `color`/`background` pair — **57 failing pairs found, reduced to
4 intentional ones.**

| Root cause | Failing pairs | Fix |
|---|---|---|
| `background: white` / `color: white` keywords never tokenised | 20+ | Tokenised; the two on inverting fills now use `--paper` |
| `--brand` fill with `--accent` text — brand sand stays light in dark mode, so the text inverted to light-on-light (1.66:1) | 9 | New `--on-brand` role: always dark ink, because brand fill is always light |
| `--signal` solid fill with white text — **failed in light mode too** at 2.80:1 | 6 | New `--accent-fill` / `--accent-fill-text` pair; dark mode uses light-blue-on-dark-text |
| `--brand-strong` used as *text* (sand on white, 1.82:1) | 4 | Switched to `--text-secondary` |
| `--paper` on hero/auth overlays sitting on photography — would have inverted to dark text over an image | 4 | Pinned to `--n-0` (always white) |
| Secondary text on `--surface-sunken` landing at 4.2:1 | ~15 | One token change: `--text-secondary` alpha 0.66 → 0.74 |
| My own primitives: danger-hover white on a light-red fill, tertiary text on sunken | 6 | Corrected in `primitives.css` |

Two genuine pre-existing bugs surfaced that were unrelated to the refactor:
`.shop-pagination button` on mobile rendered its chevron in `--accent` on an
`--accent` fill (an invisible icon, masked by `font-size: 0`), and `.shop-apply`
referenced `var(--ink)` — a token that does not exist.

**The 4 remaining failures are deliberate:** disabled form controls (WCAG 1.4.3
explicitly exempts them) and the Nagad provider logo, where the orange is brand
fidelity.

### Second remediation round — the actual invisible-text cause

Screenshots showed white panels with unreadable labels that neither audit had
flagged. Both audits only compared `color` and `background` **declared in the
same rule**, so they were blind to two failure modes:

**1. Undefined custom properties — 49 call sites across 9 variables.**

`--ink` (×21), `--accent-10`, `--accent-14`, `--accent-35`, `--brand-soft`,
`--admin-surface`, `--admin-primary`, `--admin-soft`, `--font-heading` were
referenced throughout the stylesheet but **never defined anywhere**. An
undefined `var()` is invalid at computed-value time: `color` silently falls
back to `inherit` and `background` to `transparent`. That is why filter-panel
labels and section headings rendered unreadable — they were never actually
getting a colour. This predates the token work; dark mode only made it obvious.

Fixed by defining all nine as aliases in the compatibility bridge, repairing
every call site without editing one of them.

**2. Form controls had no themed background.**

There was no global `background` for `input` / `select` / `textarea`, so they
inherited the user-agent default (white). In dark mode that produced light text
on a white field — the unreadable search box and "Featured" select in the
screenshots. Fixed with a `:where()`-wrapped base rule (specificity 0, so every
existing component rule still wins) plus `color-scheme` on both themes so native
widgets, scrollbars and select popups follow suit.

Also: `::placeholder` combined `--accent-72` with `opacity: 0.72`, and Firefox
dims placeholders again on top of that. Now a single `--text-tertiary` at
`opacity: 1`.

**Theme toggle** added to the storefront header (`ThemeToggle.tsx`) alongside the
admin controls, so both surfaces can switch light/dark.

### Third round — translucent surfaces and the floating cart

The dark theme still rendered a light header, hero panel and filter sidebar. Cause:
**24 hardcoded `rgba(255, 255, 255, …)` backgrounds** — the frosted-glass surfaces
(sticky header, mobile nav, admin subnav, hero scrim, shop filter panel, checkout
chips). They were invisible to both audits because the value parser split on
whitespace and silently dropped every `rgba()` written with spaces.

Fixed by adding three themed translucent roles — `--surface-glass`,
`--surface-glass-soft`, `--surface-glass-faint` — and mapping all 24 onto them by
alpha. A verification pass now reports **0 non-inverting light backgrounds** in
dark mode.

The washed-out hero was the same bug in its worst form: `.modern-home-hero::before`
is a near-opaque scrim covering the left 58% of the banner, hardcoded white, with
the headline sitting on top. In dark mode that became light-on-light. The three
responsive hero variants each resolve correctly now — desktop and tablet use an
inverting scrim with inherited ink; mobile uses a dark gradient with pinned white
text.

**Floating cart** — two defects. The pill was 88px wide, sized for the old 8–9px
type, so "Start shopping" wrapped to two lines and `overflow-wrap: anywhere`
broke it mid-word; widened to 116px, label dropped to `--text-2xs`, and wrapping
changed to `break-word`. Separately, `.floating-cart.has-items` fills with brand
sand while inheriting ink that inverts to light — unreadable in dark mode; it now
pins to `--on-brand`.

### Dialog system unification

All native browser dialogs are gone. There were three `window.confirm` calls, all
on the storefront (`CartContext`, and two in `AccountPage`); no `alert` or
`prompt` existed anywhere.

Replaced with a promise-based `ConfirmProvider` / `useConfirm()`
(`components/ui/ConfirmDialog.tsx`) built on the accessible `Modal` primitive.
The API deliberately mirrors the native call so each swap is one line:

```ts
if (!window.confirm("…")) return;   →   if (!(await confirm({ … }))) return;
```

Each dialog now carries a real title, an explanatory description, tone-aware
styling and specific button labels ("Empty bag" / "Keep order") rather than the
browser's generic OK/Cancel.

The two admin dialogs (`AdminConfirmDialog`, `AdminPasswordConfirmDialog`) were
already custom but hand-rolled — no focus trap, no Escape, no focus restore.
Both were re-based onto the same `Modal` with their public props unchanged, so
all 11 call sites were untouched while gaining correct dialog semantics. `Modal`
also picked up an optional `icon` slot for the tone glyph.

Verified: **0 occurrences of `window.confirm` in the shipped JS bundles.**

### Outstanding in this workstream

- Radius, spacing, and `!important` are **not yet migrated** — 21 radii, 194
  padding values, 25 `!important` remain. These are lower-risk than type/colour
  and can be done incrementally.
- Existing screens still use legacy classes (`.primary-action`, `.admin-table`).
  The primitives are additive; migrating surfaces onto them is the next pass and
  is where the remaining CSS volume gets deleted.
- Storefront body copy still inherits the legacy sizing in places; the admin was
  the priority since the density complaint originated there.
