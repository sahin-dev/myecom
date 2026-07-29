"use client";

import {
  BadgePercent,
  CalendarClock,
  Check,
  Edit3,
  Home,
  Layers3,
  MessageSquareText,
  Package,
  Pause,
  Percent,
  Play,
  Plus,
  RefreshCw,
  Search,
  Star,
  Store,
  Tags,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCatalog,
  GrowthAnalytics,
  Promotion,
  Review,
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminCatalog,
  fetchAdminPromotions,
  fetchAdminReviews,
  fetchGrowthAnalytics,
  formatMoney,
  moderateAdminReview,
  toggleAdminPromotion,
  updateAdminPromotion
} from "../../lib/catalog";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

const promotionPageSize = 6;
const reviewPageSize = 8;

const promotionScopes: Array<{
  value: Promotion["scope"];
  label: string;
  detail: string;
  icon: React.ReactNode;
}> = [
  { value: "ORDER", label: "Entire order", detail: "Discount the full eligible order", icon: <Layers3 size={17} /> },
  { value: "CATEGORY", label: "Categories", detail: "Only products in selected categories", icon: <Tags size={17} /> },
  { value: "BRAND", label: "Brands", detail: "Only products from selected brands", icon: <Store size={17} /> },
  { value: "PRODUCT", label: "Products", detail: "Only specifically selected products", icon: <Package size={17} /> },
  { value: "COMBO", label: "Combos", detail: "Only selected combo offers", icon: <BadgePercent size={17} /> }
];

function promotionLifecycle(promotion: Promotion) {
  const now = Date.now();
  if (new Date(promotion.endsAt).getTime() < now) return "ENDED";
  if (!promotion.isActive) return "PAUSED";
  if (new Date(promotion.startsAt).getTime() > now) return "UPCOMING";
  return "ACTIVE";
}

function promotionValue(promotion: Promotion) {
  if (promotion.type === "FREE_SHIPPING") return "Free shipping";
  return promotion.type === "PERCENTAGE"
    ? `${promotion.value}% off`
    : `${formatMoney(promotion.value)} off`;
}

export function AdminGrowth() {
  const [analytics, setAnalytics] = useState<GrowthAnalytics | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { message, kind, notify } = useAdminToast();
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({});
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({});
  const [reviewFilter, setReviewFilter] = useState<"ALL" | Review["status"] | "HOMEPAGE">("PENDING");
  const [reviewPage, setReviewPage] = useState(1);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [promotionEditorOpen, setPromotionEditorOpen] = useState(false);
  const [promotionType, setPromotionType] = useState<Promotion["type"]>("PERCENTAGE");
  const [promotionScope, setPromotionScope] = useState<Promotion["scope"]>("ORDER");
  const [promotionTargetIds, setPromotionTargetIds] = useState<string[]>([]);
  const [promotionFilter, setPromotionFilter] = useState<"ALL" | "ACTIVE" | "PAUSED" | "UPCOMING" | "ENDED">("ALL");
  const [promotionSearch, setPromotionSearch] = useState("");
  const [promotionPage, setPromotionPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [growth, offers, reviewQueue, adminCatalog] = await Promise.all([
        fetchGrowthAnalytics(days),
        fetchAdminPromotions(),
        fetchAdminReviews(),
        fetchAdminCatalog()
      ]);
      setAnalytics(growth);
      setPromotions(offers);
      setReviews(reviewQueue);
      setCatalog(adminCatalog);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Growth data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const input = {
        name: String(data.get("name")),
        code: String(data.get("code")).toUpperCase(),
        type: String(data.get("type")) as Promotion["type"],
        scope: promotionScope,
        targetIds: promotionScope === "ORDER" ? [] : promotionTargetIds,
        value: String(data.get("type")) === "FREE_SHIPPING" ? 0 : Number(data.get("value")),
        minimumOrder: Number(data.get("minimumOrder") || 0),
        maximumDiscount: Number(data.get("maximumDiscount") || 0) || undefined,
        usageLimit: Number(data.get("usageLimit") || 0) || undefined,
        perCustomerLimit: Number(data.get("perCustomerLimit") || 1),
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        isActive: data.get("isActive") === "on"
      };
      const promotion = editingPromotion
        ? await updateAdminPromotion(editingPromotion.id, input)
        : await createAdminPromotion(input);
      setPromotions((current) => editingPromotion
        ? current.map((item) => item.id === promotion.id ? promotion : item)
        : [promotion, ...current]);
      notify(`${promotion.code} is ready.`);
      closePromotionEditor();
      form.reset();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Promotion could not be created.", "error");
    }
  }

  async function togglePromotion(item: Promotion) {
    try {
      const updated = await toggleAdminPromotion(item.id, !item.isActive);
      setPromotions((current) =>
        current.map((promotion) => promotion.id === updated.id ? updated : promotion)
      );
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Promotion could not be updated.", "error");
    }
  }

  async function moderate(
    review: Review,
    status: Review["status"] = review.status,
    showOnHome: boolean = review.showOnHome
  ) {
    try {
      const updated = await moderateAdminReview(review.id, {
        status,
        adminReply: reviewReplies[review.id]?.trim() || review.adminReply || undefined,
        showOnHome,
        homePriority: reviewPriorities[review.id] ?? review.homePriority
      });
      setReviews((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      );
      notify(showOnHome ? "Review is now showcased on the homepage." : `Review saved as ${status.toLowerCase()}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Review could not be updated.", "error");
    }
  }

  async function removePromotion(item: Promotion) {
    try {
      const result = await deleteAdminPromotion(item.id);
      setPromotions((current) =>
        result.archived
          ? current.map((promotion) =>
              promotion.id === item.id ? { ...promotion, isActive: false } : promotion
            )
          : current.filter((promotion) => promotion.id !== item.id)
      );
      notify(
        result.archived
          ? `${item.code} has usage history, so it was archived instead of deleted.`
          : `${item.code} was deleted.`
      );
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Promotion could not be removed.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  function editPromotion(item: Promotion) {
    setEditingPromotion(item);
    setPromotionType(item.type);
    setPromotionScope(item.scope);
    setPromotionTargetIds(item.targetIds);
    setPromotionEditorOpen(true);
  }

  function closePromotionEditor() {
    setEditingPromotion(null);
    setPromotionType("PERCENTAGE");
    setPromotionScope("ORDER");
    setPromotionTargetIds([]);
    setPromotionEditorOpen(false);
  }

  function startPromotion() {
    closePromotionEditor();
    setPromotionEditorOpen(true);
  }

  const promotionTargetOptions = useMemo(() => {
    if (!catalog || promotionScope === "ORDER") return [];
    if (promotionScope === "CATEGORY") return catalog.categories.map((item) => ({
      id: item.id,
      name: item.name,
      detail: "Category"
    }));
    if (promotionScope === "BRAND") return catalog.brands.map((item) => ({
      id: item.id,
      name: item.name,
      detail: "Brand"
    }));
    return catalog.products
      .filter((item) => promotionScope === "COMBO" ? item.isCombo : !item.isCombo)
      .map((item) => ({
        id: item.id,
        name: item.name,
        detail: item.category?.name ?? (item.isCombo ? "Combo" : "Product")
      }));
  }, [catalog, promotionScope]);

  const promotionTargetNames = useMemo(() => {
    if (!catalog) return new Map<string, string>();
    return new Map([
      ...catalog.categories.map((item) => [item.id, item.name] as const),
      ...catalog.brands.map((item) => [item.id, item.name] as const),
      ...catalog.products.map((item) => [item.id, item.name] as const)
    ]);
  }, [catalog]);

  const visiblePromotions = useMemo(
    () => promotions.filter((promotion) => {
      const matchesStatus =
        promotionFilter === "ALL" || promotionLifecycle(promotion) === promotionFilter;
      const query = promotionSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        promotion.code.toLowerCase().includes(query) ||
        promotion.name.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    }),
    [promotionFilter, promotionSearch, promotions]
  );
  const promotionPages = Math.max(1, Math.ceil(visiblePromotions.length / promotionPageSize));
  const pagedPromotions = visiblePromotions.slice(
    (promotionPage - 1) * promotionPageSize,
    promotionPage * promotionPageSize
  );

  const visibleReviews = useMemo(
    () => reviews.filter((review) =>
      reviewFilter === "ALL"
        ? true
        : reviewFilter === "HOMEPAGE"
          ? review.showOnHome
          : review.status === reviewFilter
    ),
    [reviewFilter, reviews]
  );
  const reviewPages = Math.max(1, Math.ceil(visibleReviews.length / reviewPageSize));
  const pagedReviews = visibleReviews.slice(
    (reviewPage - 1) * reviewPageSize,
    reviewPage * reviewPageSize
  );

  useEffect(() => {
    setPromotionPage(1);
  }, [promotionFilter, promotionSearch]);

  useEffect(() => {
    if (promotionPage > promotionPages) setPromotionPage(promotionPages);
  }, [promotionPage, promotionPages]);

  useEffect(() => {
    setReviewPage(1);
    setExpandedReviewId(null);
  }, [reviewFilter]);

  useEffect(() => {
    if (reviewPage > reviewPages) setReviewPage(reviewPages);
  }, [reviewPage, reviewPages]);

  if (loading && !analytics) return <AdminLoading label="Connecting customer and revenue signals..." />;
  if (error && !analytics) return <AdminError message={error} retry={() => void load()} />;
  if (!analytics) return null;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Demand and retention"
        title="Marketing and growth"
        description="Measure demand, manage offers, moderate reviews, and find conversion opportunities."
        actions={
          <>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh growth data">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />
      <AdminToast message={message} kind={kind} />

      {deleteTarget ? (
        <AdminConfirmDialog
          title={`Delete ${deleteTarget.code}?`}
          body="Promotions already used by a customer are archived instead of deleted."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void removePromotion(deleteTarget)}
        />
      ) : null}

      <nav className="admin-subnav" aria-label="Marketing sections">
        <a href="#growth-analytics">Analytics</a>
        <a href="#growth-products">Product opportunity</a>
        <a href="#growth-promotions">Promotions</a>
        <a href="#growth-reviews">Reviews</a>
      </nav>

      <section className="admin-funnel" id="growth-analytics">
        {analytics.funnel.map((stage) => (
          <div key={stage.stage}>
            <small>{stage.stage.replace(/_/g, " ")}</small>
            <strong>{stage.value}</strong>
            <span>{stage.conversion.toFixed(1)}% from sessions</span>
          </div>
        ))}
      </section>

      <section className="admin-two-column">
        <div className="admin-data-panel">
          <AdminSectionHeader title="Acquisition efficiency" description="Revenue and conversion by first-touch source" />
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Source</th><th>Sessions</th><th>Orders</th><th>Conversion</th><th>Revenue</th></tr></thead>
              <tbody>{analytics.sources.map((source) => (
                <tr key={source.source}>
                  <td><strong>{source.source}</strong></td>
                  <td>{source.sessions}</td>
                  <td>{source.orders}</td>
                  <td>{source.conversion.toFixed(1)}%</td>
                  <td>{formatMoney(source.revenue)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="admin-data-panel">
          <AdminSectionHeader title="Search demand" description="Use these terms for merchandising and buying" />
          <div className="admin-signal-list">
            {analytics.topSearches.length ? analytics.topSearches.map((item) => (
              <div key={item.query}><Search size={16} /><strong>{item.query}</strong><span>{item.count}</span></div>
            )) : <p>No search activity in this period.</p>}
          </div>
        </div>
      </section>

      <section className="admin-data-panel" id="growth-products">
        <AdminSectionHeader title="Product opportunity" description="View-to-cart exposes interest; units and revenue confirm demand" />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Views</th><th>Added</th><th>View to cart</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{analytics.productSignals.map((item) => (
              <tr key={item.productId}>
                <td><strong>{item.name}</strong></td><td>{item.views}</td><td>{item.carts}</td>
                <td>{item.viewToCart.toFixed(1)}%</td><td>{item.units}</td><td>{formatMoney(item.revenue)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-data-panel admin-growth-workspace" id="growth-promotions">
        <div className="admin-workspace-heading">
          <div>
            <span className="admin-kicker">Campaign rules</span>
            <h2>Promotions</h2>
            <p>Control the reward, eligible products, order threshold, schedule, and usage in one place.</p>
          </div>
          <button className="primary-action" type="button" onClick={startPromotion}>
            <Plus size={17} /> New promotion
          </button>
        </div>

        <div className="promotion-overview">
          <article><span>Active now</span><strong>{promotions.filter((item) => promotionLifecycle(item) === "ACTIVE").length}</strong></article>
          <article><span>Scheduled</span><strong>{promotions.filter((item) => promotionLifecycle(item) === "UPCOMING").length}</strong></article>
          <article><span>Total uses</span><strong>{promotions.reduce((sum, item) => sum + (item._count?.redemptions ?? 0), 0)}</strong></article>
          <article><span>Discount given</span><strong>{formatMoney(promotions.reduce((sum, item) => sum + (item.redemptions ?? []).reduce((total, redemption) => total + redemption.discount, 0), 0))}</strong></article>
        </div>

        <div className="promotion-toolbar">
          <label className="admin-search-field">
            <Search size={16} />
            <input
              value={promotionSearch}
              onChange={(event) => setPromotionSearch(event.target.value)}
              placeholder="Search code or campaign name"
              aria-label="Search promotions"
            />
          </label>
          <div className="admin-segmented" aria-label="Promotion status">
            {(["ALL", "ACTIVE", "PAUSED", "UPCOMING", "ENDED"] as const).map((filter) => (
              <button
                className={promotionFilter === filter ? "active" : ""}
                key={filter}
                type="button"
                onClick={() => setPromotionFilter(filter)}
              >
                {filter.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className={`promotion-management-layout ${promotionEditorOpen ? "has-editor" : ""}`}>
          <div className="promotion-campaign-list">
            {visiblePromotions.length ? pagedPromotions.map((promotion) => {
              const lifecycle = promotionLifecycle(promotion);
              const targets = promotion.targetIds
                .map((id) => promotionTargetNames.get(id))
                .filter(Boolean);
              return (
                <article className="promotion-campaign-card" key={promotion.id}>
                  <header>
                    <div>
                      <span className="promotion-code">{promotion.code}</span>
                      <strong>{promotion.name}</strong>
                    </div>
                    <StatusBadge value={lifecycle} kind="product" />
                  </header>
                  <div className="promotion-rule-summary">
                    <span><BadgePercent size={15} /><strong>{promotionValue(promotion)}</strong></span>
                    <span><Layers3 size={15} />{promotionScopes.find((item) => item.value === promotion.scope)?.label}</span>
                    <span><CalendarClock size={15} />Minimum {promotion.minimumOrder ? formatMoney(promotion.minimumOrder) : "none"}</span>
                  </div>
                  {promotion.scope !== "ORDER" ? (
                    <p className="promotion-target-summary">
                      Applies to {targets.length ? targets.slice(0, 3).join(", ") : "no selected targets"}
                      {targets.length > 3 ? ` and ${targets.length - 3} more` : ""}
                    </p>
                  ) : null}
                  <div className="promotion-performance">
                    <span><strong>{promotion._count?.redemptions ?? 0}</strong> uses</span>
                    <span><strong>{formatMoney((promotion.redemptions ?? []).reduce((sum, item) => sum + item.discount, 0))}</strong> discount</span>
                    <span><strong>{formatMoney((promotion.orders ?? []).filter((order) => order.status !== "CANCELLED").reduce((sum, order) => sum + order.total, 0))}</strong> revenue</span>
                  </div>
                  <footer>
                    <small>
                      {new Date(promotion.startsAt).toLocaleDateString("en-BD")} to {new Date(promotion.endsAt).toLocaleDateString("en-BD")}
                    </small>
                    <div>
                      <button type="button" onClick={() => void togglePromotion(promotion)}>
                        {promotion.isActive ? <Pause size={15} /> : <Play size={15} />}
                        {promotion.isActive ? "Pause" : "Activate"}
                      </button>
                      <button type="button" onClick={() => editPromotion(promotion)}>
                        <Edit3 size={15} /> Edit
                      </button>
                      <button className="icon-only danger" type="button" onClick={() => setDeleteTarget(promotion)} title="Delete promotion" aria-label={`Delete ${promotion.code}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </footer>
                </article>
              );
            }) : (
              <div className="admin-empty-state">
                <BadgePercent size={24} />
                <strong>No promotions match this view</strong>
                <p>Change the filters or create a new campaign.</p>
              </div>
            )}
            <AdminPagination
              page={promotionPage}
              pages={promotionPages}
              total={visiblePromotions.length}
              pageSize={promotionPageSize}
              onPageChange={setPromotionPage}
            />
          </div>

          {promotionEditorOpen ? (
            <form className="promotion-builder" onSubmit={createPromotion} key={editingPromotion?.id ?? "new-promotion"}>
              <header>
                <div>
                  <span className="admin-kicker">{editingPromotion ? "Edit campaign" : "New campaign"}</span>
                  <h3>{editingPromotion ? editingPromotion.code : "Configure promotion"}</h3>
                </div>
                <button className="admin-icon-button" type="button" onClick={closePromotionEditor} title="Close editor" aria-label="Close promotion editor">
                  <X size={17} />
                </button>
              </header>

              <fieldset>
                <legend>1. Campaign identity</legend>
                <div className="form-grid">
                  <label>Campaign name<input name="name" placeholder="Summer pantry offer" defaultValue={editingPromotion?.name ?? ""} required /></label>
                  <label>Coupon code<input name="code" placeholder="PANTRY10" defaultValue={editingPromotion?.code ?? ""} required /></label>
                </div>
              </fieldset>

              <fieldset>
                <legend>2. Customer reward</legend>
                <div className="form-grid">
                  <label>Reward type
                    <select name="type" value={promotionType} onChange={(event) => setPromotionType(event.target.value as Promotion["type"])}>
                      <option value="PERCENTAGE">Percentage discount</option>
                      <option value="FIXED">Fixed amount discount</option>
                      <option value="FREE_SHIPPING">Free shipping</option>
                    </select>
                  </label>
                  <label>Reward value
                    <input
                      key={`${editingPromotion?.id ?? "new"}-${promotionType}`}
                      name="value"
                      type="number"
                      min={promotionType === "PERCENTAGE" ? 1 : 0}
                      max={promotionType === "PERCENTAGE" ? 100 : undefined}
                      step="0.01"
                      placeholder={promotionType === "PERCENTAGE" ? "For example, 10" : "Discount amount"}
                      defaultValue={promotionType === "FREE_SHIPPING" ? 0 : editingPromotion?.value ?? ""}
                      disabled={promotionType === "FREE_SHIPPING"}
                      required
                    />
                  </label>
                </div>
                {promotionType === "PERCENTAGE" ? (
                  <label>Maximum discount
                    <input name="maximumDiscount" type="number" min="0.01" placeholder="No cap when empty" defaultValue={editingPromotion?.maximumDiscount ?? ""} />
                  </label>
                ) : null}
              </fieldset>

              <fieldset>
                <legend>3. What can receive this promotion?</legend>
                <div className="promotion-scope-options">
                  {promotionScopes.map((scope) => (
                    <label className={promotionScope === scope.value ? "active" : ""} key={scope.value}>
                      <input
                        type="radio"
                        name="scope"
                        value={scope.value}
                        checked={promotionScope === scope.value}
                        onChange={() => {
                          setPromotionScope(scope.value);
                          setPromotionTargetIds([]);
                        }}
                      />
                      {scope.icon}
                      <span><strong>{scope.label}</strong><small>{scope.detail}</small></span>
                    </label>
                  ))}
                </div>
                {promotionScope !== "ORDER" ? (
                  <div className="promotion-target-picker">
                    <div>
                      <strong>Select eligible {promotionScopes.find((item) => item.value === promotionScope)?.label.toLowerCase()}</strong>
                      <span>{promotionTargetIds.length} selected</span>
                    </div>
                    <div>
                      {promotionTargetOptions.map((option) => (
                        <label key={option.id}>
                          <input
                            type="checkbox"
                            checked={promotionTargetIds.includes(option.id)}
                            onChange={(event) => setPromotionTargetIds((current) =>
                              event.target.checked
                                ? [...current, option.id]
                                : current.filter((id) => id !== option.id)
                            )}
                          />
                          <span><strong>{option.name}</strong><small>{option.detail}</small></span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="promotion-scope-note">The reward is calculated from the full order subtotal.</p>
                )}
              </fieldset>

              <fieldset>
                <legend>4. Order eligibility and limits</legend>
                <div className="form-grid">
                  <label>Minimum order value<input name="minimumOrder" type="number" min="0" placeholder="No minimum" defaultValue={editingPromotion?.minimumOrder || ""} /></label>
                  <label>Uses per customer<input name="perCustomerLimit" type="number" min="1" defaultValue={editingPromotion?.perCustomerLimit ?? 1} /></label>
                </div>
                <label>Total usage limit<input name="usageLimit" type="number" min="1" placeholder="Unlimited when empty" defaultValue={editingPromotion?.usageLimit ?? ""} /></label>
              </fieldset>

              <fieldset>
                <legend>5. Schedule</legend>
                <div className="form-grid">
                  <label>Starts<input name="startsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.startsAt).toISOString().slice(0, 16) : ""} required /></label>
                  <label>Ends<input name="endsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.endsAt).toISOString().slice(0, 16) : ""} required /></label>
                </div>
                <label className="check-row">
                  <input name="isActive" type="checkbox" defaultChecked={editingPromotion?.isActive ?? true} />
                  Active and available during this schedule
                </label>
              </fieldset>

              <footer>
                <button className="secondary-action" type="button" onClick={closePromotionEditor}>Cancel</button>
                <button className="primary-action" type="submit">
                  <Percent size={17} /> {editingPromotion ? "Save changes" : "Create promotion"}
                </button>
              </footer>
            </form>
          ) : null}
        </div>
      </section>

      <section className="admin-data-panel admin-growth-workspace" id="growth-reviews">
        <div className="admin-workspace-heading">
          <div>
            <span className="admin-kicker">Customer feedback</span>
            <h2>Product reviews</h2>
            <p>Moderate submissions first. Public replies and homepage placement are separate publishing controls.</p>
          </div>
          <a className="secondary-action" href="/admin?tab=content&content=testimonials">
            <Star size={16} /> Add curated review
          </a>
        </div>

        <div className="review-overview">
          <article><span>Needs decision</span><strong>{reviews.filter((item) => item.status === "PENDING").length}</strong></article>
          <article><span>Approved</span><strong>{reviews.filter((item) => item.status === "APPROVED").length}</strong></article>
          <article><span>On homepage</span><strong>{reviews.filter((item) => item.showOnHome).length}</strong></article>
        </div>

        <div className="review-moderation-toolbar">
          <div className="admin-segmented" aria-label="Review status">
            {(["PENDING", "APPROVED", "REJECTED", "HOMEPAGE", "ALL"] as const).map((filter) => {
              const count = reviews.filter((review) =>
                filter === "ALL"
                  ? true
                  : filter === "HOMEPAGE"
                    ? review.showOnHome
                    : review.status === filter
              ).length;
              return (
                <button className={reviewFilter === filter ? "active" : ""} key={filter} type="button" onClick={() => setReviewFilter(filter)}>
                  {filter === "HOMEPAGE" ? "Homepage" : filter.toLowerCase()} <span>{count}</span>
                </button>
              );
            })}
          </div>
          <small>{visibleReviews.length} {visibleReviews.length === 1 ? "review" : "reviews"} in this view</small>
        </div>

        <div className="review-moderation-list">
          {visibleReviews.length ? pagedReviews.map((review) => {
            const expanded = expandedReviewId === review.id;
            return (
              <article className={`review-moderation-card ${expanded ? "is-expanded" : ""}`} key={review.id}>
                <header>
                  <div>
                    <strong>{review.product?.name ?? "Product review"}</strong>
                    <span>
                      {review.user?.name ?? "Customer"}
                      {review.isVerified ? " - Verified purchase" : ""}
                      {review.createdAt ? ` - ${new Date(review.createdAt).toLocaleDateString("en-BD")}` : ""}
                    </span>
                  </div>
                  <div>
                    {review.showOnHome ? <span className="review-home-badge"><Home size={13} /> Homepage</span> : null}
                    <StatusBadge value={review.status} kind="product" />
                  </div>
                </header>
                <div className="review-submission">
                  <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"} />
                    ))}
                  </span>
                  {review.title ? <h3>{review.title}</h3> : null}
                  <p>{review.comment}</p>
                </div>
                <div className="review-decision-bar">
                  <div>
                    {review.status !== "APPROVED" ? (
                      <button className="approve" type="button" onClick={() => void moderate(review, "APPROVED")}>
                        <Check size={16} /> Approve
                      </button>
                    ) : null}
                    {review.status !== "REJECTED" ? (
                      <button className="reject" type="button" onClick={() => void moderate(review, "REJECTED")}>
                        <X size={16} /> Reject
                      </button>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => setExpandedReviewId(expanded ? null : review.id)}>
                    <MessageSquareText size={16} /> {expanded ? "Close settings" : "Reply and publish"}
                  </button>
                </div>

                {expanded ? (
                  <div className="review-expanded-settings">
                    <section className="review-setting-section">
                      <div>
                        <strong>Public store response</strong>
                        <small>Shown below the customer review on the product page.</small>
                      </div>
                      <textarea
                        value={reviewReplies[review.id] ?? review.adminReply ?? ""}
                        onChange={(event) => setReviewReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                        placeholder="Write a helpful response, or leave blank"
                      />
                      <button className="secondary-action" type="button" onClick={() => void moderate(review)}>
                        <Check size={16} /> Save response
                      </button>
                    </section>

                    <section className={`review-setting-section ${review.status === "APPROVED" ? "" : "is-disabled"}`}>
                      <div>
                        <strong>Homepage curation</strong>
                        <small>{review.status === "APPROVED" ? "Feature strong approved feedback on the storefront." : "Approve this review before featuring it."}</small>
                      </div>
                      <label>
                        Display order
                        <input
                          type="number"
                          value={reviewPriorities[review.id] ?? review.homePriority}
                          onChange={(event) => setReviewPriorities((current) => ({
                            ...current,
                            [review.id]: Number(event.target.value)
                          }))}
                          disabled={review.status !== "APPROVED"}
                        />
                      </label>
                      <button
                        className={review.showOnHome ? "secondary-action active" : "secondary-action"}
                        type="button"
                        disabled={review.status !== "APPROVED"}
                        onClick={() => void moderate(review, "APPROVED", !review.showOnHome)}
                      >
                        <Home size={16} /> {review.showOnHome ? "Remove from homepage" : "Show on homepage"}
                      </button>
                    </section>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="admin-empty-state">
              <MessageSquareText size={24} />
              <strong>No reviews in this queue</strong>
              <p>Select another status to review previous decisions.</p>
            </div>
          )}
          <AdminPagination
            page={reviewPage}
            pages={reviewPages}
            total={visibleReviews.length}
            pageSize={reviewPageSize}
            onPageChange={setReviewPage}
          />
        </div>
      </section>
    </div>
  );
}
