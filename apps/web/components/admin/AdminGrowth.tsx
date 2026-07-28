"use client";

import { Check, Home, Percent, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  GrowthAnalytics,
  Promotion,
  Review,
  createAdminPromotion,
  deleteAdminPromotion,
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
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

export function AdminGrowth() {
  const [analytics, setAnalytics] = useState<GrowthAnalytics | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { message, kind, notify } = useAdminToast();
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({});
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({});
  const [reviewFilter, setReviewFilter] = useState<"ALL" | Review["status"] | "HOMEPAGE">("ALL");
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [promotionType, setPromotionType] = useState<Promotion["type"]>("PERCENTAGE");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [growth, offers, reviewQueue] = await Promise.all([
        fetchGrowthAnalytics(days),
        fetchAdminPromotions(),
        fetchAdminReviews()
      ]);
      setAnalytics(growth);
      setPromotions(offers);
      setReviews(reviewQueue);
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
        value: String(data.get("type")) === "FREE_SHIPPING" ? 0 : Number(data.get("value")),
        minimumOrder: Number(data.get("minimumOrder") || 0),
        maximumDiscount: Number(data.get("maximumDiscount") || 0) || undefined,
        usageLimit: Number(data.get("usageLimit") || 0) || undefined,
        perCustomerLimit: Number(data.get("perCustomerLimit") || 1),
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        isActive: editingPromotion?.isActive ?? true
      };
      const promotion = editingPromotion
        ? await updateAdminPromotion(editingPromotion.id, input)
        : await createAdminPromotion(input);
      setPromotions((current) => editingPromotion
        ? current.map((item) => item.id === promotion.id ? promotion : item)
        : [promotion, ...current]);
      notify(`${promotion.code} is ready.`);
      setEditingPromotion(null);
      setPromotionType("PERCENTAGE");
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
  }

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

      <section className="admin-two-column">
        <div className="admin-data-panel" id="growth-promotions">
          <AdminSectionHeader title="Promotions" description="Guarded by dates, usage limits, and minimum spend" />
          <div className="admin-compact-list">
            {promotions.map((promotion) => (
              <article className="admin-promotion-row" key={promotion.id}>
                <div>
                  <strong>{promotion.code}</strong>
                  <span>{promotion.name}</span>
                  <small>
                    {new Date(promotion.startsAt).toLocaleDateString("en-BD")} - {new Date(promotion.endsAt).toLocaleDateString("en-BD")}
                  </small>
                </div>
                <div className="admin-promotion-metrics">
                  <span><strong>{promotion._count?.redemptions ?? 0}</strong> uses</span>
                  <span>
                    <strong>{formatMoney((promotion.redemptions ?? []).reduce((sum, item) => sum + item.discount, 0))}</strong>
                    discount
                  </span>
                  <span>
                    <strong>{formatMoney((promotion.orders ?? []).filter((order) => order.status !== "CANCELLED").reduce((sum, order) => sum + order.total, 0))}</strong>
                    revenue
                  </span>
                </div>
                <div>
                  <small>
                    {promotion.type === "PERCENTAGE"
                      ? `${promotion.value}%`
                      : promotion.type === "FREE_SHIPPING"
                        ? "Free shipping"
                        : formatMoney(promotion.value)}
                  </small>
                  <StatusBadge value={promotion.isActive ? "ACTIVE" : "PAUSED"} kind="product" />
                  <button type="button" onClick={() => void togglePromotion(promotion)}>
                    {promotion.isActive ? "Pause" : "Activate"}
                  </button>
                  <button type="button" onClick={() => editPromotion(promotion)}>Edit</button>
                  <button type="button" onClick={() => setDeleteTarget(promotion)} title="Delete promotion"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
          <form className="admin-inline-form promotion-admin-form" onSubmit={createPromotion} key={editingPromotion?.id ?? "new-promotion"}>
            <div className="form-grid">
              <label>Offer name<input name="name" placeholder="For example, Summer pantry offer" defaultValue={editingPromotion?.name ?? ""} required /></label>
              <label>Coupon code<input name="code" placeholder="For example, PANTRY10" defaultValue={editingPromotion?.code ?? ""} required /></label>
            </div>
            <div className="form-grid">
              <label>Discount type
                <select
                  name="type"
                  value={promotionType}
                  onChange={(event) => setPromotionType(event.target.value as Promotion["type"])}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                </select>
              </label>
              <label>Discount value
                <input
                  key={`${editingPromotion?.id ?? "new"}-${promotionType}`}
                  name="value"
                  type="number"
                  min={promotionType === "PERCENTAGE" ? 1 : 0}
                  max={promotionType === "PERCENTAGE" ? 100 : undefined}
                  step="0.01"
                  placeholder={promotionType === "PERCENTAGE" ? "Percentage from 1 to 100" : "Discount amount"}
                  defaultValue={promotionType === "FREE_SHIPPING" ? 0 : editingPromotion?.value ?? ""}
                  disabled={promotionType === "FREE_SHIPPING"}
                  required
                />
              </label>
            </div>
            <div className="form-grid">
              <label>Minimum order<input name="minimumOrder" type="number" min="0" placeholder="No minimum when empty" defaultValue={editingPromotion?.minimumOrder ?? ""} /></label>
              <label>Maximum discount<input name="maximumDiscount" type="number" min="0" placeholder="No cap when empty" defaultValue={editingPromotion?.maximumDiscount ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Total usage limit<input name="usageLimit" type="number" min="1" placeholder="Unlimited when empty" defaultValue={editingPromotion?.usageLimit ?? ""} /></label>
              <label>Uses per customer<input name="perCustomerLimit" type="number" min="1" defaultValue={editingPromotion?.perCustomerLimit ?? 1} /></label>
            </div>
            <div className="form-grid">
              <label>Starts publishing<input name="startsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.startsAt).toISOString().slice(0, 16) : ""} required /></label>
              <label>Stops publishing<input name="endsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.endsAt).toISOString().slice(0, 16) : ""} required /></label>
            </div>
            <button className="primary-action full" type="submit"><Percent size={17} /> {editingPromotion ? "Save promotion" : "Create promotion"}</button>
            {editingPromotion ? <button className="secondary-action full" type="button" onClick={() => { setEditingPromotion(null); setPromotionType("PERCENTAGE"); }}>Cancel editing</button> : null}
          </form>
        </div>

        <div className="admin-data-panel" id="growth-reviews">
          <AdminSectionHeader title="Product reviews" description="Moderate customer feedback and select approved reviews for the homepage" />
          <div className="admin-review-toolbar">
            <div className="admin-segmented">
              {(["ALL", "PENDING", "APPROVED", "REJECTED", "HOMEPAGE"] as const).map((filter) => (
                <button
                  className={reviewFilter === filter ? "active" : ""}
                  key={filter}
                  type="button"
                  onClick={() => setReviewFilter(filter)}
                >
                  {filter === "HOMEPAGE" ? "Homepage" : filter.toLowerCase()}
                </button>
              ))}
            </div>
            <a className="secondary-action" href="/admin?tab=content&content=testimonials">
              <Star size={16} /> Add curated review
            </a>
          </div>
          <div className="admin-review-queue">
            {reviews.filter((review) =>
              reviewFilter === "ALL"
                ? true
                : reviewFilter === "HOMEPAGE"
                  ? review.showOnHome
                  : review.status === reviewFilter
            ).length ? reviews.filter((review) =>
              reviewFilter === "ALL"
                ? true
                : reviewFilter === "HOMEPAGE"
                  ? review.showOnHome
                  : review.status === reviewFilter
            ).map((review) => (
              <article key={review.id}>
                <div>
                  <div>
                    <strong>{review.product?.name ?? "Product review"}</strong>
                    <small>{review.user?.name ?? "Customer"}{review.isVerified ? " - Verified purchase" : ""}</small>
                  </div>
                  <StatusBadge value={review.status} kind="product" />
                </div>
                <span>{Array.from({ length: review.rating }).map((_, index) => <Star key={index} size={13} fill="currentColor" />)}</span>
                {review.title ? <strong>{review.title}</strong> : null}
                <p>{review.comment}</p>
                <textarea
                  value={reviewReplies[review.id] ?? review.adminReply ?? ""}
                  onChange={(event) => setReviewReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                  placeholder="Public store reply (optional)"
                />
                <div className="admin-review-settings">
                  <label>
                    Homepage order
                    <input
                      type="number"
                      value={reviewPriorities[review.id] ?? review.homePriority}
                      onChange={(event) => setReviewPriorities((current) => ({
                        ...current,
                        [review.id]: Number(event.target.value)
                      }))}
                    />
                  </label>
                  <span className={review.showOnHome ? "featured" : ""}>
                    <Home size={14} /> {review.showOnHome ? "On homepage" : "Not showcased"}
                  </span>
                </div>
                <div className="admin-review-actions">
                  {review.status !== "APPROVED" ? (
                    <button type="button" onClick={() => void moderate(review, "APPROVED")} title="Approve"><Check size={16} /> Approve</button>
                  ) : null}
                  {review.status !== "REJECTED" ? (
                    <button type="button" onClick={() => void moderate(review, "REJECTED")} title="Reject"><X size={16} /> Reject</button>
                  ) : null}
                  <button type="button" onClick={() => void moderate(review)}><Check size={16} /> Save</button>
                  {review.status === "APPROVED" ? (
                    <button
                      type="button"
                      className={review.showOnHome ? "active" : ""}
                      onClick={() => void moderate(review, "APPROVED", !review.showOnHome)}
                    >
                      <Home size={16} /> {review.showOnHome ? "Remove from home" : "Show on home"}
                    </button>
                  ) : null}
                </div>
              </article>
            )) : <p>No reviews need attention.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
