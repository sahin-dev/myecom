"use client";

import {
  ArrowLeft,
  Check,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
  Truck
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Address,
  CartLine,
  Catalog,
  Order,
  PromotionValidation,
  analyticsSessionKey,
  createCheckout,
  fallbackCatalog,
  fetchAddresses,
  fetchCatalog,
  fetchProduct,
  formatMoney,
  initiateBkashPayment,
  isBaseProductEnabled,
  trackAnalyticsEvent,
  validatePromotion
} from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";

function formatAddress(address: Address) {
  return [
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.postalCode
  ].filter(Boolean).join(", ");
}

export function CheckoutPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [directLine, setDirectLine] = useState<CartLine | null>(null);
  const [directLoading, setDirectLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [promotion, setPromotion] = useState<PromotionValidation | null>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionNotice, setPromotionNotice] = useState("");
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [deliveryMethodCode, setDeliveryMethodCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const { cart, cartReady, clearCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
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

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get("product");
    if (!productSlug) {
      setDirectLoading(false);
      return;
    }

    fetchProduct(productSlug)
      .then((product) => {
        const activeVariants = (product.variants ?? []).filter((variant) => variant.isActive);
        const requestedVariant = params.get("variant");
        const variant = activeVariants.find((item) => item.id === requestedVariant) ?? null;
        if (activeVariants.length && !variant && !isBaseProductEnabled(product)) {
          throw new Error(`${product.name} requires an option selection.`);
        }
        const available = variant?.inventory ?? product.inventory;
        if (available < 1) throw new Error(`${product.name} is currently out of stock.`);
        const requestedQuantity = Math.max(1, Number(params.get("quantity")) || 1);
        setDirectLine({
          product,
          variant,
          quantity: Math.min(requestedQuantity, available)
        });
      })
      .catch((caught) => {
        setNotice(caught instanceof Error ? caught.message : "This product could not be prepared for checkout.");
      })
      .finally(() => setDirectLoading(false));
  }, []);

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

  const checkoutLines = useMemo(
    () => directLine ? [directLine] : cart,
    [cart, directLine]
  );
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
  const ready = !directLoading && (directLine ? true : cartReady);

  function chooseAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = addresses.find((item) => item.id === addressId);
    if (address) setShippingAddress(formatAddress(address));
  }

  async function applyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromotionNotice("");
    try {
      const result = await validatePromotion(
        promotionCode.trim(),
        subtotal,
        checkoutLines.map((line) => ({
          productId: line.product.id,
          variantId: line.variant?.id,
          quantity: line.quantity
        }))
      );
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
    if (!checkoutLines.length) return;
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
      if (!directLine) clearCart();

      if (paymentMethodCode === "BKASH") {
        try {
          const { bkashURL } = await initiateBkashPayment(created.id);
          window.location.href = bkashURL;
          return;
        } catch (bkashError) {
          setNotice(
            bkashError instanceof Error
              ? `Your order was placed, but bKash payment could not be started: ${bkashError.message}`
              : "Your order was placed, but bKash payment could not be started. Please contact support."
          );
        }
      }
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

  return (
    <main className="checkout-page">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} />
      <header className="checkout-page-heading">
        <a href={directLine ? `/products/${directLine.product.slug}` : "/shop"}>
          <ArrowLeft size={16} /> Continue shopping
        </a>
        <p className="eyebrow">Secure checkout</p>
        <h1>Complete your order</h1>
        <p>Review your items, choose delivery, and confirm your details.</p>
      </header>

      {!ready ? (
        <div className="checkout-empty">Preparing your order...</div>
      ) : !checkoutLines.length ? (
        <section className="checkout-empty">
          <ShoppingBag size={32} />
          <h2>Your bag is empty</h2>
          <p>Add products before continuing to checkout.</p>
          <a className="primary-action" href="/shop">Browse products</a>
        </section>
      ) : (
        <section className="product-checkout-section checkout-page-shell">
          <div className="checkout-summary">
            <p className="eyebrow">Order summary</p>
            <h2>{checkoutLines.length} {checkoutLines.length === 1 ? "item" : "items"}</h2>
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
                      {line.variant ? `${line.variant.name} / ` : ""}
                      Quantity: {line.quantity}
                    </span>
                  </div>
                  <strong>
                    {formatMoney((line.variant?.price ?? line.product.price) * line.quantity)}
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
            <div className="cost-line"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
            {discount > 0 ? (
              <div className="cost-line discount"><span>Offer</span><strong>-{formatMoney(discount)}</strong></div>
            ) : null}
            <div className="cost-line">
              <span>Delivery</span>
              <strong>{shippingFee ? formatMoney(shippingFee) : "Free"}</strong>
            </div>
            <div className="cost-line grand-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
            <p className="secure-note"><ShieldCheck size={18} /> Your order information is sent securely.</p>
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
                <Truck size={18} /> Track this order
              </a>
            </div>
          ) : (
            <form className="checkout-panel product-checkout-form" onSubmit={checkout}>
              <p className="eyebrow">Delivery details</p>
              <h2>Where should we send it?</h2>
              {addresses.length ? (
                <label className="field-label">
                  Saved address
                  <select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}>
                    {addresses.map((address) => (
                      <option value={address.id} key={address.id}>
                        {address.label} / {address.city}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="form-grid">
                <label className="field-label">Full name<input name="customerName" placeholder="Person receiving the order" defaultValue={user?.name ?? ""} required /></label>
                <label className="field-label">Phone number<input name="phone" placeholder="Delivery contact number" defaultValue={user?.phone ?? ""} required /></label>
              </div>
              <label className="field-label">Email address<input name="email" type="email" placeholder="Order confirmation email" defaultValue={user?.email ?? ""} required /></label>
              <label className="field-label">Shipping address
                <textarea
                  name="shippingAddress"
                  placeholder="House, road, area, and city"
                  value={shippingAddress}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  required
                />
              </label>
              {deliveryMethods.length ? (
                <label className="field-label">
                  Delivery method
                  <select value={deliveryMethodCode || deliveryMethods[0].code} onChange={(event) => setDeliveryMethodCode(event.target.value)}>
                    {deliveryMethods.map((method) => (
                      <option value={method.code} key={method.id}>
                        {method.name}{method.fee ? ` / ${formatMoney(method.fee)}` : " / Free"}
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
              {notice ? <p className="detail-notice">{notice}</p> : null}
              <button
                className="primary-action full"
                type="submit"
                disabled={placingOrder || !paymentMethods.length || !deliveryMethods.length}
              >
                <CreditCard size={18} />
                {placingOrder ? "Placing order..." : `Place order - ${formatMoney(total)}`}
              </button>
              <p className="form-note">Your selected payment and delivery methods are confirmed with the order.</p>
            </form>
          )}
        </section>
      )}
      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}
