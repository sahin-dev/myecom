"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Catalog,
  Product,
  ProductVariant,
  Review,
  baseProductOptionLabel,
  deleteProductReview,
  fallbackProducts,
  fetchMyProductReview,
  fetchProductReviews,
  fetchStockAlertSubscription,
  isBaseProductEnabled,
  productAdvancePaymentLabel,
  productAdvancePaymentPercent,
  resolveMediaUrl,
  submitProductReview,
  subscribeStockAlert,
  trackAnalyticsEvent
} from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { useWishlist } from "./WishlistContext";

const money = (value: number) => `\u09F3${new Intl.NumberFormat("en-BD").format(value)}`;
const reviewDate = new Intl.DateTimeFormat("en-BD", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : reviewDate.format(date);
}

function reviewerInitial(name?: string) {
  return (name?.trim().charAt(0) || "C").toUpperCase();
}

function productDetailKey(detail: { type: string; title: string }) {
  return `${detail.type}:${detail.title}`;
}

function productDetailLabel(type: string) {
  const labels: Record<string, string> = {
    usage: "Usage",
    storage: "Storage",
    nutrition: "Nutrition",
    ingredients: "Ingredients",
    side_effects: "Side effects",
    warnings: "Warnings"
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function ProductDetailIcon({ type }: { type: string }) {
  if (type === "usage") return <PackageCheck size={18} />;
  if (type === "storage") return <ShieldCheck size={18} />;
  if (type === "nutrition") return <BadgeCheck size={18} />;
  if (type === "ingredients") return <Star size={18} />;
  if (type === "warnings" || type === "side_effects") return <Bell size={18} />;
  return <PackageCheck size={18} />;
}

function ProductDetailContent({ content }: { content: string }) {
  const lines = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return (
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }
  return <p>{content}</p>;
}

function preferredVariant(product: Product, requestedId?: string) {
  const active = product.variants?.filter((variant) => variant.isActive) ?? [];
  const requested = active.find((variant) => variant.id === requestedId);
  if (requested) return requested;
  if (isBaseProductEnabled(product) && product.inventory > 0) return null;
  return active.find((variant) => variant.inventory > 0)
    ?? (isBaseProductEnabled(product) ? null : active[0] ?? null);
}

function availableQuantity(product: Product, variant: ProductVariant | null, requested: number) {
  const inventory = variant?.inventory ?? product.inventory;
  return Math.max(1, Math.min(requested, inventory || requested));
}

export function ProductDetails({
  slug,
  initialProduct,
  initialCatalog,
  initialVariantId,
  initialQuantity = 1
}: {
  slug: string;
  initialProduct: Product;
  initialCatalog: Catalog;
  initialVariantId?: string;
  initialQuantity?: number;
}) {
  const product = initialProduct;
  const catalog = initialCatalog;
  const initialVariant = preferredVariant(initialProduct, initialVariantId);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(initialVariant);
  const [activeImage, setActiveImage] = useState<string | null>(
    resolveMediaUrl(initialProduct.images?.[0]?.url ?? initialProduct.imageUrl) || null
  );
  const [quantity, setQuantity] = useState(
    availableQuantity(initialProduct, initialVariant, initialQuantity)
  );
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");
  const [stockAlertRequested, setStockAlertRequested] = useState(false);
  const [stockAlertChecking, setStockAlertChecking] = useState(false);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [activeProductDetailKey, setActiveProductDetailKey] = useState("");
  const [reviews, setReviews] = useState<Review[]>(initialProduct.reviews ?? []);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviewNotice, setReviewNotice] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isSaved, toggle } = useWishlist();

  useEffect(() => {
    const variant = preferredVariant(initialProduct, initialVariantId);
    setSelectedVariant(variant);
    setActiveImage(resolveMediaUrl(initialProduct.images?.[0]?.url ?? initialProduct.imageUrl) || null);
    setQuantity(availableQuantity(initialProduct, variant, initialQuantity));
    setNotice("");
    setNoticeTone("info");
    setStockAlertRequested(false);
    setStockAlertChecking(false);
    setReviews(initialProduct.reviews ?? []);
  }, [initialProduct, initialQuantity, initialVariantId, slug]);

  useEffect(() => {
    let active = true;
    void fetchProductReviews(product.id)
      .then((result) => {
        if (active) setReviews(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product.id]);

  useEffect(() => {
    if (!user) {
      setMyReview(null);
      return;
    }
    let active = true;
    void fetchMyProductReview(product.id)
      .then((result) => {
        if (active) setMyReview(result);
      })
      .catch(() => {
        if (active) setMyReview(null);
      });
    return () => {
      active = false;
    };
  }, [product.id, user?.id]);

  useEffect(() => {
    void trackAnalyticsEvent({ type: "PRODUCT_VIEWED", productId: product.id })
      .catch(() => undefined);
  }, [product.id]);

  const availableInventory = selectedVariant?.inventory ?? product.inventory;
  const baseEnabled = isBaseProductEnabled(product);
  const requiresVariant =
    !baseEnabled && Boolean(product.variants?.some((variant) => variant.isActive));
  const canPurchase =
    availableInventory > 0 && (!requiresVariant || Boolean(selectedVariant));
  const unitPrice = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;
  const productSummary = useMemo(() => {
    const description = product.description.replace(/\s+/g, " ").trim();
    if (description.length <= 170) return description;
    const firstSentence = description.match(/^(.+?[.!?])\s/)?.[1];
    if (firstSentence && firstSentence.length <= 180) return firstSentence;
    return `${description.slice(0, 165).trim()}...`;
  }, [product.description]);
  const advancePercent = productAdvancePaymentPercent(product, catalog.siteSettings.checkoutPolicy);
  const advanceLabel = productAdvancePaymentLabel(product, catalog.siteSettings.checkoutPolicy);
  const productDetailSections = useMemo(
    () =>
      (product.details ?? [])
        .map((detail) => ({
          type: String(detail.type ?? "").trim(),
          title: String(detail.title ?? "").trim(),
          content: String(detail.content ?? "").trim()
        }))
        .filter((detail) => detail.type && detail.title && detail.content),
    [product.details]
  );
  const activeProductDetail =
    productDetailSections.find((detail) => productDetailKey(detail) === activeProductDetailKey)
    ?? productDetailSections[0];

  useEffect(() => {
    if (!productDetailSections.length) {
      setActiveProductDetailKey("");
      return;
    }
    if (!productDetailSections.some((detail) => productDetailKey(detail) === activeProductDetailKey)) {
      setActiveProductDetailKey(productDetailKey(productDetailSections[0]));
    }
  }, [activeProductDetailKey, productDetailSections]);

  useEffect(() => {
    if (!user || availableInventory > 0) {
      setStockAlertRequested(false);
      setStockAlertChecking(false);
      return;
    }

    let active = true;
    setStockAlertRequested(false);
    setStockAlertChecking(true);
    void fetchStockAlertSubscription(product.id, selectedVariant?.id)
      .then((result) => {
        if (active) setStockAlertRequested(result.subscribed);
      })
      .catch(() => {
        if (active) setStockAlertRequested(false);
      })
      .finally(() => {
        if (active) setStockAlertChecking(false);
      });

    return () => {
      active = false;
    };
  }, [availableInventory, product.id, selectedVariant?.id, user?.id]);

  const galleryImages = useMemo(
    () =>
      [
        ...(product.images ?? []).map((image) => ({
          url: resolveMediaUrl(image.url),
          alt: image.alt ?? product.name
        })),
        ...(product.imageUrl &&
        !(product.images ?? []).some((image) => image.url === product.imageUrl)
          ? [{ url: resolveMediaUrl(product.imageUrl), alt: product.name }]
          : [])
      ]
        .filter((image) => image.url)
        .filter(
          (image, index, images) =>
            images.findIndex((candidate) => candidate.url === image.url) === index
        )
        .slice(0, 5),
    [product]
  );
  const related = useMemo(
    () =>
      [...catalog.justForYou, ...catalog.trendingProducts, ...fallbackProducts]
        .filter(
          (item) =>
            item.slug !== product.slug &&
            (item.categoryId === product.categoryId || item.brandId === product.brandId)
        )
        .filter(
          (item, index, items) =>
            items.findIndex((candidate) => candidate.slug === item.slug) === index
        )
        .slice(0, 5),
    [catalog, product]
  );
  const selectedDelivery = catalog.checkoutMethods.find(
    (method) => method.type === "DELIVERY" && method.isActive
  );
  const activeImageIndex = galleryImages.findIndex((image) => image.url === activeImage);

  function goToImage(delta: number) {
    if (!galleryImages.length) return;
    const current = activeImageIndex === -1 ? 0 : activeImageIndex;
    const next = (current + delta + galleryImages.length) % galleryImages.length;
    setActiveImage(galleryImages[next].url);
  }

  function chooseVariant(variant: ProductVariant | null) {
    setSelectedVariant(variant);
    setQuantity(1);
    setStockAlertRequested(false);
    setNotice("");
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : product.rating ?? 0;
  const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review) => review.rating === rating).length;
    return {
      rating,
      count,
      percentage: reviews.length ? (count / reviews.length) * 100 : 0
    };
  });

  function changeQuantity(delta: number) {
    setQuantity((current) =>
      Math.min(Math.max(current + delta, 1), Math.max(availableInventory, 1))
    );
  }

  async function notifyStock() {
    if (stockAlertRequested) {
      setNotice("Your restock alert is already active for this option.");
      setNoticeTone("success");
      return;
    }
    if (!user) {
      setNotice("Sign in to get notified when this is back in stock.");
      setNoticeTone("info");
      return;
    }
    setStockAlertLoading(true);
    setNotice("");
    try {
      await subscribeStockAlert(product.id, selectedVariant?.id);
      setStockAlertRequested(true);
      setNotice("We'll email you when this is back in stock.");
      setNoticeTone("success");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not set up the stock alert.");
      setNoticeTone("error");
    } finally {
      setStockAlertLoading(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setReviewNotice("Sign in to share a verified product review.");
      return;
    }

    const data = new FormData(event.currentTarget);
    setSubmittingReview(true);
    setReviewNotice("");
    try {
      const savedReview = await submitProductReview(product.id, {
        rating: Number(data.get("rating")),
        title: String(data.get("title") ?? ""),
        comment: String(data.get("review"))
      });
      setMyReview(savedReview);
      setReviews(await fetchProductReviews(product.id));
      setReviewNotice(
        myReview
          ? "Your changes were saved and are awaiting moderation."
          : "Thank you. Your review is awaiting moderation."
      );
      void trackAnalyticsEvent({
        type: "REVIEW_SUBMITTED",
        productId: product.id
      });
    } catch (caught) {
      setReviewNotice(caught instanceof Error ? caught.message : "Your review could not be submitted.");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function removeMyReview() {
    try {
      await deleteProductReview(product.id);
      setReviews(await fetchProductReviews(product.id));
      setMyReview(null);
      setReviewNotice("Your review was removed.");
    } catch (caught) {
      setReviewNotice(caught instanceof Error ? caught.message : "Your review could not be removed.");
    }
  }

  return (
    <main id="top">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} />

      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={`/shop?category=${product.category?.slug ?? ""}`}>
          {product.category?.name ?? "Products"}
        </Link>
        <span>/</span>
        <strong>{product.name}</strong>
      </div>

      <section className="product-detail-shell">
        <div className="product-gallery">
          <div className="thumbnail-rail" aria-label="Product views">
            {galleryImages.length > 0 ? (
              galleryImages.map((image) => (
                <button
                  className={activeImage === image.url ? "active" : ""}
                  type="button"
                  key={image.url}
                  onClick={() => setActiveImage(image.url)}
                  aria-label={`View ${image.alt}`}
                >
                  <img src={image.url} alt="" />
                </button>
              ))
            ) : (
              <div className="active product-art-placeholder">
                <ProductArt compact product={product} />
              </div>
            )}
          </div>
          <div className="main-product-art">
            <div className="main-product-image-frame" key={activeImage ?? "generated-art"}>
              {activeImage ? (
                <img src={activeImage} alt={product.name} />
              ) : (
                <ProductArt product={product} />
              )}
            </div>
            {galleryImages.length > 1 ? (
              <>
                <button
                  type="button"
                  className="horizontal-rail-control gallery-nav prev"
                  onClick={() => goToImage(-1)}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="horizontal-rail-control gallery-nav next"
                  onClick={() => goToImage(1)}
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="product-purchase">
          <p className="eyebrow">{product.category?.name ?? "Pantry selection"}</p>
          <div className="product-title-row">
            <h1>{product.name}</h1>
            <button
              className="icon-button"
              type="button"
              onClick={() => toggle(product)}
              aria-label={isSaved(product.slug) ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart size={20} fill={isSaved(product.slug) ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="product-summary-line">
            <a href="#customer-reviews" aria-label={`Read ${reviews.length} customer reviews`}>
              <span className="stars" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    size={14}
                    fill={index < Math.round(averageRating) ? "currentColor" : "none"}
                  />
                ))}
              </span>
              <strong>{averageRating.toFixed(1)}</strong>
              <span>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
            </a>
            <span className={`stock-status ${availableInventory > 0 ? "available" : "unavailable"}`}>
              {availableInventory > 0 ? `${availableInventory} in stock` : "Out of stock"}
            </span>
          </div>
          <div className="detail-price">
            <strong>{money(unitPrice)}</strong>
            {compareAt ? <small>{money(compareAt)}</small> : null}
          </div>
          {advanceLabel ? (
            <div className="product-advance-panel">
              <span><CreditCard size={18} /></span>
              <div>
                <strong>{advanceLabel}</strong>
                <p>
                  Pay {advancePercent}% of this product value online now. The remaining product amount and delivery fee are due later.
                </p>
              </div>
            </div>
          ) : null}
          <p className="product-description">{productSummary}</p>

          {product.variants?.length ? (
            <div className="variant-picker">
              <span>Choose an option</span>
              <div>
                {baseEnabled ? (
                  <button
                    className={selectedVariant === null ? "active" : ""}
                    type="button"
                    onClick={() => chooseVariant(null)}
                    disabled={product.inventory < 1}
                  >
                    {baseProductOptionLabel(product)}
                  </button>
                ) : null}
                {product.variants
                  .filter((variant) => variant.isActive)
                  .map((variant) => (
                    <button
                      className={selectedVariant?.id === variant.id ? "active" : ""}
                      type="button"
                      key={variant.id}
                      onClick={() => chooseVariant(variant)}
                      disabled={variant.inventory < 1}
                    >
                      {variant.name}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="product-facts">
            <span>
              <ShieldCheck size={18} /> Quality checked
            </span>
            <span>
              <Truck size={18} /> {selectedDelivery
                ? `${selectedDelivery.name}${selectedDelivery.minDeliveryDays ? ` in ${selectedDelivery.minDeliveryDays}-${selectedDelivery.maxDeliveryDays ?? selectedDelivery.minDeliveryDays} days` : ""}`
                : "Delivery configured at checkout"}
            </span>
            <span>
              <PackageCheck size={18} /> {availableInventory > 0
                ? `${availableInventory} items available`
                : "Restock alert available"}
            </span>
            {advanceLabel ? (
              <span>
                <CreditCard size={18} /> Advance payment applies
              </span>
            ) : null}
          </div>
          {availableInventory < 1 ? (
            <div className={`stock-alert-panel ${stockAlertRequested ? "active" : ""}`}>
              <div className="stock-alert-copy">
                <span><Bell size={19} /></span>
                <div>
                  <strong>{stockAlertRequested ? "Restock alert is active" : "Get a restock alert"}</strong>
                  <p>
                    {stockAlertRequested
                      ? "You are on the list. We will email you when this option is available again."
                      : "We will email you as soon as this option is available again."}
                  </p>
                </div>
              </div>
              <button
                className="secondary-action"
                type="button"
                disabled={stockAlertRequested || stockAlertLoading || stockAlertChecking}
                onClick={() => void notifyStock()}
              >
                <Bell size={18} />
                {stockAlertChecking
                  ? "Checking alert..."
                  : stockAlertLoading
                  ? "Setting up alert..."
                  : stockAlertRequested
                    ? "You are on the list"
                    : "Notify me when available"}
              </button>
            </div>
          ) : (
            <>
              <div className="quantity-row">
                <span>Quantity</span>
                <div className="detail-quantity">
                  <button type="button" onClick={() => changeQuantity(-1)} aria-label="Decrease quantity">
                    <Minus size={17} />
                  </button>
                  <strong>{quantity}</strong>
                  <button type="button" onClick={() => changeQuantity(1)} aria-label="Increase quantity">
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div className="detail-actions">
              <button
                className="secondary-action"
                type="button"
                disabled={!canPurchase}
                onClick={() => {
                  addItem(product, quantity, selectedVariant);
                  setNotice(`${quantity} x ${product.name} added to your bag.`);
                  setNoticeTone("success");
                }}
              >
                <ShoppingBag size={18} />
                Add to cart
              </button>
                <button
                  className={`primary-action ${canPurchase ? "" : "disabled-link"}`}
                  type="button"
                  disabled={!canPurchase}
                  onClick={() => {
                    const query = new URLSearchParams({
                      product: product.slug,
                      quantity: String(quantity)
                    });
                    if (selectedVariant) query.set("variant", selectedVariant.id);
                    window.location.assign(`/checkout?${query.toString()}`);
                  }}
                >
                  <CreditCard size={18} />
                  Buy now
                </button>
              </div>
            </>
          )}
          {product.brand ? (
            <div className="brand-chip">
              <span>Brand</span>
              <strong>{product.brand.name}</strong>
            </div>
          ) : null}
          {notice ? <p className={`detail-notice ${noticeTone}`} role="status">{notice}</p> : null}
        </div>
      </section>

      <section className="detail-info-band">
        <div>
          <p className="eyebrow">Product details</p>
          <h2>About {product.name}</h2>
        </div>
        <div className="detail-info-copy">
          <p>{product.description}</p>
          <div className="detail-care-notes">
            <span><ShieldCheck size={16} /> Quality checked before dispatch</span>
            <span><PackageCheck size={16} /> Store sealed in a cool, dry place</span>
          </div>
        </div>
        <div className="tag-list">
          {product.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {product.isCombo && product.comboProducts?.length ? (
          <div className="detail-combo-products">
            <strong><PackageCheck size={17} /> Included in this combo</strong>
            <div>
              {product.comboProducts.map((item) => {
                const image = resolveMediaUrl(item.imageUrl);
                return (
                  <Link href={`/products/${item.slug}`} key={item.id}>
                    <span>{image ? <img src={image} alt="" /> : <PackageCheck size={18} />}</span>
                    <div><strong>{item.name}</strong><small>{money(item.price)} individually</small></div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {productDetailSections.length ? (
        <section className="product-extra-details" aria-labelledby="product-guidance-title">
          <header className="product-guidance-head">
            <div>
              <p className="eyebrow">Product guidance</p>
              <h2 id="product-guidance-title">Use, care, and product facts</h2>
              <p>Clear instructions and safety notes from the product team.</p>
            </div>
            <span>{productDetailSections.length} detail{productDetailSections.length === 1 ? "" : "s"}</span>
          </header>
          <div className="product-guidance-panel">
            <nav className="product-detail-index" aria-label="Product detail sections">
              {productDetailSections.map((detail) => (
                <button
                  className={activeProductDetail && productDetailKey(activeProductDetail) === productDetailKey(detail) ? "active" : ""}
                  type="button"
                  onClick={() => setActiveProductDetailKey(productDetailKey(detail))}
                  key={`index-${detail.type}-${detail.title}`}
                >
                  <ProductDetailIcon type={detail.type} />
                  <span>{productDetailLabel(detail.type)}</span>
                </button>
              ))}
            </nav>
            {activeProductDetail ? (
              <div className="product-detail-card-grid">
                <article
                  className={`product-detail-card detail-${activeProductDetail.type}`}
                  key={productDetailKey(activeProductDetail)}
                >
                  <header>
                    <span><ProductDetailIcon type={activeProductDetail.type} /></span>
                    <div>
                      <small>{productDetailLabel(activeProductDetail.type)}</small>
                      <h3>{activeProductDetail.title}</h3>
                    </div>
                  </header>
                  <ProductDetailContent content={activeProductDetail.content} />
                </article>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="product-review-section" id="customer-reviews">
        <header className="review-section-heading">
          <div>
            <p className="eyebrow">Customer feedback</p>
            <h2>Reviews from our customers</h2>
            <p>Helpful experiences from people who have tried this product.</p>
          </div>
          <div className="review-score" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
            <strong>{averageRating.toFixed(1)}</strong>
            <div>
              <span className="stars" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    size={17}
                    fill={index < Math.round(averageRating) ? "currentColor" : "none"}
                  />
                ))}
              </span>
              <small>{reviews.length} {reviews.length === 1 ? "submitted review" : "submitted reviews"}</small>
            </div>
          </div>
        </header>

        <div className="review-layout">
          <div className="review-feed">
            <div className="rating-breakdown" aria-label="Rating breakdown">
              {ratingBreakdown.map((item) => (
                <div key={item.rating}>
                  <span>{item.rating} <Star size={12} fill="currentColor" /></span>
                  <span className="rating-track"><i style={{ width: `${item.percentage}%` }} /></span>
                  <small>{item.count}</small>
                </div>
              ))}
            </div>
            <div className="review-feed-heading">
              <div>
                <h3>Submitted reviews</h3>
                <p>Published feedback for {product.name}</p>
              </div>
              <span>{reviews.length}</span>
            </div>
            {reviews.length ? (
              <div className="review-list">
                {reviews.map((review) => (
                  <article key={review.id}>
                    <header>
                      <span className="reviewer-avatar" aria-hidden="true">
                        {reviewerInitial(review.user?.name)}
                      </span>
                      <div>
                        <strong>{review.user?.name ?? "Customer"}</strong>
                        <small>{formatReviewDate(review.createdAt)}</small>
                      </div>
                      {review.isVerified ? (
                        <span className="verified-review"><BadgeCheck size={14} /> Verified purchase</span>
                      ) : null}
                    </header>
                    <div className="review-rating-row">
                      <span className="stars" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={index}
                            size={14}
                            fill={index < review.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </span>
                      <small>{review.rating}.0</small>
                    </div>
                    {review.title ? <h4>{review.title}</h4> : null}
                    <p>{review.comment}</p>
                    {review.adminReply ? (
                      <div className="review-reply">
                        <strong>Response from the store</strong>
                        <p>{review.adminReply}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-review-list">
                <Star size={24} />
                <strong>No submitted reviews yet</strong>
                <p>Be the first customer to share a useful experience.</p>
              </div>
            )}
          </div>

          <form
            className="review-form"
            key={myReview ? `${myReview.id}-${myReview.updatedAt ?? myReview.status}` : "new-review"}
            onSubmit={submitReview}
          >
            <p className="eyebrow">Your feedback</p>
            <h3>{myReview ? "Manage your review" : "Write a review"}</h3>
            <p className="review-form-intro">
              {user
                ? "Tell other customers what stood out about this product."
                : "Sign in to submit and manage your product review."}
            </p>
            {myReview ? (
              <div className={`customer-review-state ${myReview.status.toLowerCase()}`}>
                <strong>{myReview.status === "APPROVED" ? "Published" : myReview.status === "PENDING" ? "Awaiting approval" : "Needs revision"}</strong>
                <span>Editing sends the review back to moderation.</span>
              </div>
            ) : null}
            <label className="field-label">Rating
              <select name="rating" defaultValue={myReview?.rating ? String(myReview.rating) : ""} required>
                <option value="" disabled>Select your rating</option>
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Very good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
            </label>
            <label className="field-label">Review title
              <input
                name="title"
                placeholder="Summarize your experience"
                defaultValue={myReview?.title ?? ""}
              />
            </label>
            <label className="field-label">Your review
              <textarea
                name="review"
                placeholder="Share product quality, packaging, and delivery details"
                defaultValue={myReview?.comment ?? ""}
                required
              />
            </label>
            <button className="primary-action review-submit" type="submit" disabled={submittingReview}>
              {submittingReview ? "Saving..." : myReview ? "Update review" : "Submit review"}
            </button>
            {myReview ? <button className="text-link danger" type="button" onClick={() => void removeMyReview()}>Delete my review</button> : null}
            {reviewNotice ? <p className="detail-notice" role="status">{reviewNotice}</p> : null}
          </form>
        </div>
      </section>

      <section className="related-products">
        <div className="section-title">
          <h2>Related products</h2>
          <Link href="/shop">More products</Link>
        </div>
        <div className="product-grid">
          {related.map((item) => (
            <article className="product-card related-card" key={item.id}>
              <Link href={`/products/${item.slug}`}>
                <ProductArt product={item} />
              </Link>
              <div className="product-meta">
                <h3><Link href={`/products/${item.slug}`}>{item.name}</Link></h3>
                <div className="price-row">
                  <strong>{money(item.price)}</strong>
                  {item.compareAt ? <small>{money(item.compareAt)}</small> : null}
                </div>
              </div>
              {productAdvancePaymentLabel(item, catalog.siteSettings.checkoutPolicy) ? (
                <span
                  className="advance-payment-badge"
                  title={productAdvancePaymentLabel(item, catalog.siteSettings.checkoutPolicy)}
                  aria-label={productAdvancePaymentLabel(item, catalog.siteSettings.checkoutPolicy)}
                >
                  <CreditCard size={14} />
                </span>
              ) : null}
              <Link className="secondary-action full" href={`/products/${item.slug}`}>
                View details
              </Link>
            </article>
          ))}
        </div>
      </section>

      <div className="mobile-purchase-bar">
        <div className="mobile-purchase-summary">
          {product.variants?.length ? (
            <label className="mobile-option-select">
              <span>Option</span>
              <select
                value={selectedVariant?.id ?? "base"}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  chooseVariant(nextValue === "base" ? null : product.variants?.find((variant) => variant.id === nextValue) ?? null);
                }}
              >
                {baseEnabled ? (
                  <option value="base" disabled={product.inventory < 1}>
                    {baseProductOptionLabel(product)}
                  </option>
                ) : null}
                {product.variants
                  .filter((variant) => variant.isActive)
                  .map((variant) => (
                    <option value={variant.id} key={variant.id} disabled={variant.inventory < 1}>
                      {variant.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <small>{product.name}</small>
          )}
          <strong>{money(unitPrice)}</strong>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={availableInventory < 1 ? stockAlertRequested || stockAlertLoading || stockAlertChecking : !canPurchase}
          onClick={() => {
            if (availableInventory < 1) {
              void notifyStock();
              return;
            }
            if (requiresVariant && !selectedVariant) {
              document.querySelector(".variant-picker")?.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });
              return;
            }
            addItem(product, quantity, selectedVariant);
            setNotice(`${quantity} x ${product.name} added to your bag.`);
            setNoticeTone("success");
          }}
        >
          {availableInventory < 1 ? <Bell size={17} /> : <ShoppingBag size={17} />}
          {availableInventory < 1
            ? stockAlertChecking
              ? "Checking..."
              : stockAlertLoading
              ? "Setting alert..."
              : stockAlertRequested
                ? "Alert active"
                : "Notify me"
            : requiresVariant && !selectedVariant
              ? "Choose option"
              : "Add to cart"}
        </button>
      </div>

      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
      <a className="float-action up" href="#top" aria-label="Back to top">
        <ChevronLeft size={20} />
      </a>
    </main>
  );
}
