"use client";

import { Check, Percent, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
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
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  StatusBadge
} from "./AdminShared";

export function AdminGrowth() {
  const [analytics, setAnalytics] = useState<GrowthAnalytics | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewReplies, setReviewReplies] = useState<Record<string, string>>({});
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

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
        value: Number(data.get("value")),
        minimumOrder: Number(data.get("minimumOrder") || 0),
        maximumDiscount: Number(data.get("maximumDiscount") || 0) || undefined,
        usageLimit: Number(data.get("usageLimit") || 0) || undefined,
        perCustomerLimit: Number(data.get("perCustomerLimit") || 1),
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        isActive: true
      };
      const promotion = editingPromotion
        ? await updateAdminPromotion(editingPromotion.id, input)
        : await createAdminPromotion(input);
      setPromotions((current) => editingPromotion
        ? current.map((item) => item.id === promotion.id ? promotion : item)
        : [promotion, ...current]);
      setMessage(`${promotion.code} is ready.`);
      setEditingPromotion(null);
      form.reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Promotion could not be created.");
    }
  }

  async function togglePromotion(item: Promotion) {
    try {
      const updated = await toggleAdminPromotion(item.id, !item.isActive);
      setPromotions((current) =>
        current.map((promotion) => promotion.id === updated.id ? updated : promotion)
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Promotion could not be updated.");
    }
  }

  async function moderate(review: Review, status: Review["status"]) {
    try {
      const updated = await moderateAdminReview(review.id, {
        status,
        adminReply: reviewReplies[review.id]?.trim() || review.adminReply || undefined
      });
      setReviews((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      );
      setMessage(`Review marked ${status.toLowerCase()}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Review could not be updated.");
    }
  }

  async function removePromotion(item: Promotion) {
    if (!window.confirm(`Delete ${item.code}?`)) return;
    try {
      await deleteAdminPromotion(item.id);
      setPromotions((current) => current.filter((promotion) => promotion.id !== item.id));
      setMessage(`${item.code} was removed or archived.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Promotion could not be removed.");
    }
  }

  if (loading && !analytics) return <AdminLoading label="Connecting customer and revenue signals..." />;
  if (error && !analytics) return <AdminError message={error} retry={() => void load()} />;
  if (!analytics) return null;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Demand and retention"
        title="Growth"
        description="See where demand originates, where shoppers drop off, and which actions can improve conversion."
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
      {message ? <p className="admin-message">{message}</p> : null}

      <section className="admin-funnel">
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

      <section className="admin-data-panel">
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
        <div className="admin-data-panel">
          <AdminSectionHeader title="Promotions" description="Guarded by dates, usage limits, and minimum spend" />
          <div className="admin-compact-list">
            {promotions.map((promotion) => (
              <article key={promotion.id}>
                <div><strong>{promotion.code}</strong><span>{promotion.name}</span></div>
                <div>
                  <small>{promotion.type === "PERCENTAGE" ? `${promotion.value}%` : formatMoney(promotion.value)}</small>
                  <button type="button" onClick={() => void togglePromotion(promotion)}>
                    {promotion.isActive ? "Pause" : "Activate"}
                  </button>
                  <button type="button" onClick={() => setEditingPromotion(promotion)}>Edit</button>
                  <button type="button" onClick={() => void removePromotion(promotion)} title="Delete promotion"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
          <form className="admin-inline-form promotion-admin-form" onSubmit={createPromotion} key={editingPromotion?.id ?? "new-promotion"}>
            <div className="form-grid"><input name="name" placeholder="Offer name" defaultValue={editingPromotion?.name ?? ""} required /><input name="code" placeholder="Code" defaultValue={editingPromotion?.code ?? ""} required /></div>
            <div className="form-grid">
              <select name="type" defaultValue={editingPromotion?.type ?? "PERCENTAGE"}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option><option value="FREE_SHIPPING">Free shipping</option></select>
              <input name="value" type="number" min="0" step="0.01" placeholder="Value" defaultValue={editingPromotion?.value ?? ""} required />
            </div>
            <div className="form-grid"><input name="minimumOrder" type="number" min="0" placeholder="Minimum order" defaultValue={editingPromotion?.minimumOrder ?? ""} /><input name="maximumDiscount" type="number" min="0" placeholder="Maximum discount" defaultValue={editingPromotion?.maximumDiscount ?? ""} /></div>
            <div className="form-grid"><input name="usageLimit" type="number" min="1" placeholder="Total uses" defaultValue={editingPromotion?.usageLimit ?? ""} /><input name="perCustomerLimit" type="number" min="1" defaultValue={editingPromotion?.perCustomerLimit ?? 1} /></div>
            <div className="form-grid"><input name="startsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.startsAt).toISOString().slice(0, 16) : ""} required /><input name="endsAt" type="datetime-local" defaultValue={editingPromotion ? new Date(editingPromotion.endsAt).toISOString().slice(0, 16) : ""} required /></div>
            <button className="primary-action full" type="submit"><Percent size={17} /> {editingPromotion ? "Save promotion" : "Create promotion"}</button>
            {editingPromotion ? <button className="secondary-action full" type="button" onClick={() => setEditingPromotion(null)}>Cancel editing</button> : null}
          </form>
        </div>

        <div className="admin-data-panel">
          <AdminSectionHeader title="Review moderation" description="Approve useful feedback and reject abuse before publication" />
          <div className="admin-review-queue">
            {reviews.length ? reviews.slice(0, 12).map((review) => (
              <article key={review.id}>
                <div>
                  <strong>{review.product?.name ?? "Product review"}</strong>
                  <StatusBadge value={review.status} kind="product" />
                </div>
                <span>{Array.from({ length: review.rating }).map((_, index) => <Star key={index} size={13} fill="currentColor" />)}</span>
                <p>{review.comment}</p>
                <textarea
                  value={reviewReplies[review.id] ?? review.adminReply ?? ""}
                  onChange={(event) => setReviewReplies((current) => ({ ...current, [review.id]: event.target.value }))}
                  placeholder="Public store reply (optional)"
                />
                {review.status === "PENDING" ? (
                  <div>
                    <button type="button" onClick={() => void moderate(review, "APPROVED")} title="Approve"><Check size={16} /> Approve</button>
                    <button type="button" onClick={() => void moderate(review, "REJECTED")} title="Reject"><X size={16} /> Reject</button>
                  </div>
                ) : <button type="button" onClick={() => void moderate(review, review.status)}>Save reply</button>}
              </article>
            )) : <p>No reviews need attention.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
