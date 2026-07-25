"use client";

import {
  BadgeCheck,
  Check,
  ChevronLeft,
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
  Address,
  CartLine,
  Catalog,
  Order,
  Product,
  ProductVariant,
  PromotionValidation,
  Review,
  analyticsSessionKey,
  createCheckout,
  deleteProductReview,
  fallbackCatalog,
  fallbackProducts,
  fetchAddresses,
  fetchCatalog,
  fetchProduct,
  fetchProductReviews,
  submitProductReview,
  trackAnalyticsEvent,
  validatePromotion
} from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { useWishlist } from "./WishlistContext";

const money = (value: number) => `\u09F3${new Intl.NumberFormat("en-BD").format(value)}`;

function formatAddress(address: Address) {
  return [
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.postalCode
  ]
    .filter(Boolean)
    .join(", ");
}

export function ProductDetails({ slug }: { slug: string }) {
  const fallback = fallbackProducts.find((item) => item.slug === slug) ?? fallbackProducts[0];
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [product, setProduct] = useState<Product>(fallback);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(fallback.imageUrl ?? null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [productReady, setProductReady] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"product" | "cart">("product");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [promotion, setPromotion] = useState<PromotionValidation | null>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionNotice, setPromotionNotice] = useState("");
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [deliveryMethodCode, setDeliveryMethodCode] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewNotice, setReviewNotice] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const { cart, addItem, clearCart } = useCart();
  const { user } = useAuth();
  const { isSaved, toggle } = useWishlist();

  useEffect(() => {
    setProductReady(false);
    fetchCatalog()
      .then((result) => {
        setCatalog(result);
        setPaymentMethodCode(
          result.checkoutMethods.find((method) => method.type === "PAYMENT" && method.isActive)?.code ?? ""
        );
        setDeliveryMethodCode(
          result.checkoutMethods.find((method) => method.type === "DELIVERY" && method.isActive)?.code ?? ""
        );
      })
      .catch(() => setCatalog(fallbackCatalog));

    fetchProduct(slug)
      .then((result) => {
        setProduct(result);
        const firstVariant = result.variants?.find((variant) => variant.isActive) ?? null;
        setSelectedVariant(firstVariant);
        setActiveImage(result.images?.[0]?.url ?? result.imageUrl ?? null);
        setProductReady(true);
        return Promise.all([
          fetchProductReviews(result.id).then(setReviews),
          trackAnalyticsEvent({ type: "PRODUCT_VIEWED", productId: result.id })
        ]);
      })
      .catch(() => {
        setProduct(fallback);
        setReviews(fallback.reviews ?? []);
        setProductReady(false);
        setNotice("Product options could not be loaded. Please refresh and try again.");
      });

    const params = new URLSearchParams(window.location.search);
    const requestedQuantity = Number(params.get("quantity"));
    if (Number.isInteger(requestedQuantity) && requestedQuantity > 0) {
      setQuantity(Math.min(requestedQuantity, fallback.inventory || requestedQuantity));
    }
    if (params.get("checkout") === "cart") setCheckoutMode("cart");
  }, [fallback, slug]);

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      setSelectedAddressId("");
      return;
    }

    fetchAddresses()
      .then((result) => {
        setAddresses(result);
        const preferred = result.find((address) => address.isDefault) ?? result[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setShippingAddress(formatAddress(preferred));
        }
      })
      .catch(() => setAddresses([]));
  }, [user]);

  const availableInventory = selectedVariant?.inventory ?? product.inventory;
  const requiresVariant = Boolean(product.variants?.some((variant) => variant.isActive));
  const canPurchase =
    productReady && availableInventory > 0 && (!requiresVariant || Boolean(selectedVariant));
  const unitPrice = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant?.compareAt ?? product.compareAt;
  const galleryImages = useMemo(
    () =>
      [
        ...(product.images ?? []).map((image) => ({
          url: image.url,
          alt: image.alt ?? product.name
        })),
        ...(product.imageUrl &&
        !(product.images ?? []).some((image) => image.url === product.imageUrl)
          ? [{ url: product.imageUrl, alt: product.name }]
          : [])
      ].slice(0, 5),
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
  const checkoutLines: CartLine[] =
    checkoutMode === "cart" && cart.length
      ? cart
      : [{ product, variant: selectedVariant, quantity }];
  const canCheckout = checkoutMode === "cart" && cart.length ? true : canPurchase;
  const subtotal = checkoutLines.reduce(
    (total, line) =>
      total + (line.variant?.price ?? line.product.price) * line.quantity,
    0
  );
  const discount = promotion?.discount ?? 0;
  const paymentMethods = catalog.checkoutMethods.filter(
    (method) => method.type === "PAYMENT" && method.isActive
  );
  const deliveryMethods = catalog.checkoutMethods.filter(
    (method) => method.type === "DELIVERY" && method.isActive
  );
  const selectedDelivery =
    deliveryMethods.find((method) => method.code === deliveryMethodCode) ??
    deliveryMethods[0];
  const shippingFee =
    promotion?.freeShipping ||
    Boolean(selectedDelivery?.freeThreshold && subtotal - discount >= selectedDelivery.freeThreshold)
      ? 0
      : selectedDelivery?.fee ?? 0;
  const total = Math.max(subtotal - discount + shippingFee, 0);
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : product.rating ?? 0;

  function changeQuantity(delta: number) {
    setQuantity((current) =>
      Math.min(Math.max(current + delta, 1), Math.max(availableInventory, 1))
    );
  }

  function chooseAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = addresses.find((item) => item.id === addressId);
    if (address) setShippingAddress(formatAddress(address));
  }

  async function applyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromotionNotice("");
    try {
      const result = await validatePromotion(promotionCode.trim(), subtotal);
      setPromotion(result);
      setPromotionCode(result.code);
      setPromotionNotice(`${result.name} has been applied.`);
      void trackAnalyticsEvent({
        type: "COUPON_APPLIED",
        metadata: { code: result.code, discount: result.discount }
      });
    } catch (caught) {
      setPromotion(null);
      setPromotionNotice(caught instanceof Error ? caught.message : "This offer is not available.");
    }
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheckout) {
      setNotice("Please wait for the product options to load before placing your order.");
      return;
    }
    setPlacingOrder(true);
    setNotice("");
    const form = new FormData(event.currentTarget);

    void trackAnalyticsEvent({
      type: "CHECKOUT_STARTED",
      metadata: { subtotal, itemCount: checkoutLines.length }
    });

    try {
      const created = await createCheckout({
        customerName: String(form.get("customerName")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        shippingAddress: String(form.get("shippingAddress")),
        addressId: selectedAddressId || undefined,
        promotionCode: promotion?.code,
        paymentMethod: paymentMethodCode,
        deliveryMethodCode,
        sessionKey: analyticsSessionKey(),
        idempotencyKey: window.crypto.randomUUID(),
        items: checkoutLines.map((line) => ({
          productId: line.product.id,
          variantId: line.variant?.id,
          quantity: line.quantity
        }))
      });
      setOrder(created);
      if (checkoutMode === "cart") clearCart();
      setNotice(`Order ${created.orderNumber} was placed successfully.`);
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "The order could not be placed. Please check your details and try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setReviewNotice("Sign in to share a verified product review.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmittingReview(true);
    setReviewNotice("");
    try {
      await submitProductReview(product.id, {
        rating: Number(data.get("rating")),
        title: String(data.get("title") ?? ""),
        comment: String(data.get("review"))
      });
      form.reset();
      setReviewNotice("Thank you. Your review is awaiting moderation.");
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
      setReviewNotice("Your review was removed.");
    } catch (caught) {
      setReviewNotice(caught instanceof Error ? caught.message : "Your review could not be removed.");
    }
  }

  return (
    <main id="top">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} />

      <div className="breadcrumbs">
        <a href="/">Home</a>
        <span>/</span>
        <a href={`/shop?category=${product.category?.slug ?? ""}`}>
          {product.category?.name ?? "Products"}
        </a>
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
            {activeImage ? (
              <img src={activeImage} alt={product.name} />
            ) : (
              <ProductArt product={product} />
            )}
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
          <div className="detail-price">
            <strong>{money(unitPrice)}</strong>
            {compareAt ? <small>{money(compareAt)}</small> : null}
          </div>
          <p className="product-description">{product.description}</p>

          {product.variants?.length ? (
            <div className="variant-picker">
              <span>Choose an option</span>
              <div>
                {product.variants
                  .filter((variant) => variant.isActive)
                  .map((variant) => (
                    <button
                      className={selectedVariant?.id === variant.id ? "active" : ""}
                      type="button"
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(1);
                      }}
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
              <PackageCheck size={18} /> {availableInventory} items available
            </span>
          </div>
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
              }}
            >
              <ShoppingBag size={18} />
              {!productReady
                ? "Loading options..."
                : availableInventory < 1
                  ? "Out of stock"
                  : "Add to cart"}
            </button>
            <button
              className={`primary-action ${canPurchase ? "" : "disabled-link"}`}
              type="button"
              disabled={!canPurchase}
              onClick={() => {
                document
                  .getElementById("checkout")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <CreditCard size={18} />
              Buy now
            </button>
          </div>
          {product.brand ? (
            <div className="brand-chip">
              <span>Brand</span>
              <strong>{product.brand.name}</strong>
            </div>
          ) : null}
          {notice ? <p className="detail-notice">{notice}</p> : null}
        </div>
      </section>

      <section className="detail-info-band">
        <div>
          <p className="eyebrow">Product details</p>
          <h2>Thoughtfully packed for your pantry</h2>
        </div>
        <p>{product.description} Store in a cool, dry place and keep the package sealed after opening.</p>
        <div className="tag-list">
          {product.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>

      <section className="product-checkout-section" id="checkout">
        <div className="checkout-summary">
          <p className="eyebrow">Your order</p>
          <h2>Checkout</h2>
          {cart.length ? (
            <div className="checkout-mode" aria-label="Checkout selection">
              <button
                className={checkoutMode === "product" ? "active" : ""}
                type="button"
                onClick={() => setCheckoutMode("product")}
              >
                Buy this item
              </button>
              <button
                className={checkoutMode === "cart" ? "active" : ""}
                type="button"
                onClick={() => setCheckoutMode("cart")}
              >
                Checkout bag ({cart.length})
              </button>
            </div>
          ) : null}
          <div className="checkout-lines">
            {checkoutLines.map((line) => (
              <div
                className="checkout-product-line"
                key={`${line.product.id}-${line.variant?.id ?? "base"}`}
              >
                <ProductArt compact product={line.product} />
                <div>
                  <strong>{line.product.name}</strong>
                  <span>
                    {line.variant ? `${line.variant.name} · ` : ""}
                    Quantity: {line.quantity}
                  </span>
                </div>
                <strong>
                  {money((line.variant?.price ?? line.product.price) * line.quantity)}
                </strong>
              </div>
            ))}
          </div>

          <form className="promotion-form" onSubmit={applyPromotion}>
            <input
              aria-label="Promotion code"
              value={promotionCode}
              onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
              placeholder="Promotion code"
              required
            />
            <button className="secondary-action" type="submit">Apply</button>
          </form>
          {promotionNotice ? <p className="form-note">{promotionNotice}</p> : null}

          <div className="cost-line">
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          {discount > 0 ? (
            <div className="cost-line discount">
              <span>Offer</span>
              <strong>-{money(discount)}</strong>
            </div>
          ) : null}
          <div className="cost-line">
            <span>Delivery</span>
            <strong>{shippingFee ? money(shippingFee) : "Free"}</strong>
          </div>
          <div className="cost-line grand-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="secure-note">
            <ShieldCheck size={18} />
            Your order information is sent securely.
          </p>
        </div>

        {order ? (
          <div className="order-success">
            <Check size={34} />
            <p className="eyebrow">Order confirmed</p>
            <h2>Thank you, {order.customerName}</h2>
            <p>Your order number is <strong>{order.orderNumber}</strong>.</p>
            <a
              className="primary-action"
              href={`/track-order?order=${order.orderNumber}&email=${encodeURIComponent(order.email)}`}
            >
              <Truck size={18} />
              Track this order
            </a>
          </div>
        ) : (
          <form className="checkout-panel product-checkout-form" onSubmit={checkout}>
            <p className="eyebrow">Delivery details</p>
            <h2>Where should we send it?</h2>
            {addresses.length ? (
              <label className="field-label">
                Saved address
                <select
                  value={selectedAddressId}
                  onChange={(event) => chooseAddress(event.target.value)}
                >
                  {addresses.map((address) => (
                    <option value={address.id} key={address.id}>
                      {address.label} · {address.city}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="form-grid">
              <input name="customerName" placeholder="Full name" defaultValue={user?.name ?? ""} required />
              <input name="phone" placeholder="Phone number" defaultValue={user?.phone ?? ""} required />
            </div>
            <input name="email" type="email" placeholder="Email address" defaultValue={user?.email ?? ""} required />
            <textarea
              name="shippingAddress"
              placeholder="Full shipping address"
              value={shippingAddress}
              onChange={(event) => setShippingAddress(event.target.value)}
              required
            />
            {deliveryMethods.length ? (
              <label className="field-label">
                Delivery method
                <select value={deliveryMethodCode || deliveryMethods[0].code} onChange={(event) => setDeliveryMethodCode(event.target.value)}>
                  {deliveryMethods.map((method) => (
                    <option value={method.code} key={method.id}>
                      {method.name}{method.fee ? ` · ${money(method.fee)}` : " · Free"}
                    </option>
                  ))}
                </select>
                {selectedDelivery?.description ? <small>{selectedDelivery.description}</small> : null}
              </label>
            ) : null}
            {paymentMethods.length ? (
              <label className="field-label">
                Payment method
                <select value={paymentMethodCode || paymentMethods[0].code} onChange={(event) => setPaymentMethodCode(event.target.value)}>
                  {paymentMethods.map((method) => <option value={method.code} key={method.id}>{method.name}</option>)}
                </select>
              </label>
            ) : (
              <p className="detail-notice">No payment method is currently available. Please contact support.</p>
            )}
            <button
              className="primary-action full"
              type="submit"
              disabled={placingOrder || !canCheckout || !paymentMethods.length || !deliveryMethods.length}
            >
              <CreditCard size={18} />
              {placingOrder ? "Placing order..." : `Place order - ${money(total)}`}
            </button>
            <p className="form-note">Your selected payment and delivery methods are confirmed with the order.</p>
          </form>
        )}
      </section>

      <section className="product-review-section">
        <div className="rating-overview">
          <strong>{averageRating.toFixed(1)}</strong>
          <span>Average rating</span>
          <div className="stars" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                size={19}
                fill={index < Math.round(averageRating) ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p>
            {reviews.length
              ? `${reviews.length} customer ${reviews.length === 1 ? "review" : "reviews"}`
              : "Be the first to review this product."}
          </p>
          <div className="review-list">
            {reviews.map((review) => (
              <article key={review.id}>
                <div>
                  <strong>{review.user?.name ?? "Customer"}</strong>
                  {review.isVerified ? (
                    <span><BadgeCheck size={14} /> Verified purchase</span>
                  ) : null}
                </div>
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      size={14}
                      fill={index < review.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                {review.title ? <strong>{review.title}</strong> : null}
                <p>{review.comment}</p>
                {review.adminReply ? <small>Store reply: {review.adminReply}</small> : null}
              </article>
            ))}
          </div>
        </div>
        <form className="review-form" onSubmit={submitReview}>
          <p className="eyebrow">Share your experience</p>
          <h2>Submit your review</h2>
          <input name="title" placeholder="Review title (optional)" />
          <textarea name="review" placeholder="Write your review here" required />
          <div className="form-grid">
            <select name="rating" defaultValue="" required>
              <option value="" disabled>Select rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Very good</option>
              <option value="3">3 - Good</option>
              <option value="2">2 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
            <button className="primary-action" type="submit" disabled={submittingReview}>
              {submittingReview ? "Submitting..." : "Submit review"}
            </button>
          </div>
          {user ? <button className="text-link danger" type="button" onClick={() => void removeMyReview()}>Remove my existing review</button> : null}
          {reviewNotice ? <p className="detail-notice">{reviewNotice}</p> : null}
        </form>
      </section>

      <section className="related-products">
        <div className="section-title">
          <h2>Related products</h2>
          <a href="/shop">More products</a>
        </div>
        <div className="product-grid">
          {related.map((item) => (
            <article className="product-card related-card" key={item.id}>
              <a href={`/products/${item.slug}`}>
                <ProductArt product={item} />
              </a>
              <div className="product-meta">
                <h3><a href={`/products/${item.slug}`}>{item.name}</a></h3>
                <div className="price-row">
                  <strong>{money(item.price)}</strong>
                  {item.compareAt ? <small>{money(item.compareAt)}</small> : null}
                </div>
              </div>
              <a className="secondary-action full" href={`/products/${item.slug}`}>
                View details
              </a>
            </article>
          ))}
        </div>
      </section>

      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
      <a className="float-action up" href="#top" aria-label="Back to top">
        <ChevronLeft size={20} />
      </a>
    </main>
  );
}
