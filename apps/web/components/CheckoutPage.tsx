"use client";

import {
  ArrowLeft,
  Check,
  CreditCard,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Address,
  AddressInfo,
  CartLine,
  Catalog,
  CheckoutQuote,
  Order,
  PromotionValidation,
  analyticsSessionKey,
  createCheckout,
  fallbackCatalog,
  fetchAddresses,
  fetchCatalog,
  fetchCheckoutQuote,
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

function formatAddressInfo(address: AddressInfo) {
  return [
    address.recipient,
    address.phone,
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.postalCode
  ].filter(Boolean).join(", ");
}

function checkoutLineId(line: CartLine) {
  return line.variant?.id ?? line.product.id;
}

function cleanPaymentCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function isCashPaymentMethod(method?: { code?: string; name?: string } | null) {
  const value = `${cleanPaymentCode(method?.code)} ${cleanPaymentCode(method?.name)}`;
  return value.includes("COD") || value.includes("CASH_ON_DELIVERY") || value.includes("CASH");
}

function isOnlinePaymentGroup(method?: { code?: string; name?: string } | null) {
  return cleanPaymentCode(method?.code) === "ONLINE_PAYMENT";
}

function isOnlinePaymentProvider(method?: { code?: string; name?: string; metadata?: Record<string, unknown> | null } | null) {
  if (!method || isCashPaymentMethod(method) || isOnlinePaymentGroup(method)) return false;
  const provider = cleanPaymentCode(String(method.metadata?.provider ?? ""));
  const value = `${cleanPaymentCode(method.code)} ${cleanPaymentCode(method.name)} ${provider}`;
  return ["BKASH", "NAGAD", "CARD", "SSLCOMMERZ", "STRIPE"].some((token) => value.includes(token));
}

export function CheckoutPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [directLine, setDirectLine] = useState<CartLine | null>(null);
  const [directLoading, setDirectLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingLine2, setShippingLine2] = useState("");
  const [shippingArea, setShippingArea] = useState("");
  const [shippingCity, setShippingCity] = useState("Dhaka");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [deliveryZoneCode, setDeliveryZoneCode] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [promotion, setPromotion] = useState<PromotionValidation | null>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionNotice, setPromotionNotice] = useState("");
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [deliveryMethodCode, setDeliveryMethodCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const { cart, cartReady, clearCart, updateQuantity, removeItem } = useCart();
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
          setShippingLine1(preferred.line1);
          setShippingLine2(preferred.line2 ?? "");
          setShippingArea(preferred.area ?? "");
          setShippingCity(preferred.city);
          setShippingPostalCode(preferred.postalCode ?? "");
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
  const requiredPaymentPercent = quote?.requiredPaymentPercent ?? 0;
  const activeDeliveryZones = catalog.deliveryZones.filter((zone) => zone.isActive);
  const requiresDeliveryZoneSelection = activeDeliveryZones.length > 0;
  const paymentMethods = quote ? quote.paymentMethods : catalog.checkoutMethods.filter(
    (method) => method.type === "PAYMENT" && method.isActive
  );
  const cashPaymentMethods = paymentMethods.filter(isCashPaymentMethod);
  const onlineGroupMethod = paymentMethods.find(isOnlinePaymentGroup);
  const onlineProviderMethods = paymentMethods.filter(isOnlinePaymentProvider);
  const onlinePaymentMethods = onlineProviderMethods.length
    ? onlineProviderMethods
    : onlineGroupMethod
      ? [onlineGroupMethod]
      : paymentMethods.filter((method) => !isCashPaymentMethod(method));
  const selectedPaymentCandidate = paymentMethods.find((method) => method.code === paymentMethodCode);
  const paymentMode =
    requiredPaymentPercent > 0 || !selectedPaymentCandidate || !isCashPaymentMethod(selectedPaymentCandidate)
      ? "online"
      : "cash";
  const selectedCashMethod = cashPaymentMethods.find((method) => method.code === paymentMethodCode) ?? cashPaymentMethods[0] ?? null;
  const selectedOnlineMethod = onlinePaymentMethods.find((method) => method.code === paymentMethodCode) ?? onlinePaymentMethods[0] ?? null;
  const selectedPaymentMethodCode =
    paymentMode === "online"
      ? selectedOnlineMethod?.code ?? onlineGroupMethod?.code ?? paymentMethodCode
      : selectedCashMethod?.code ?? paymentMethodCode;
  const deliveryMethods = quote ? quote.deliveryMethods : catalog.checkoutMethods.filter(
    (method) => method.type === "DELIVERY" && method.isActive
  );
  const selectedDelivery =
    deliveryMethods.find((method) => method.code === deliveryMethodCode) ??
    deliveryMethods[0];
  const fallbackShippingFee =
    promotion?.freeShipping ||
    Boolean(selectedDelivery?.freeThreshold && subtotal - discount >= selectedDelivery.freeThreshold)
      ? 0
      : selectedDelivery?.fee ?? 0;
  const shippingFee = quote?.shippingFee ?? fallbackShippingFee;
  const total = quote?.total ?? Math.max(subtotal - discount + shippingFee, 0);
  const amountDueNow = quote?.amountDueNow ?? total;
  const amountDueOnDelivery = quote?.amountDueOnDelivery ?? 0;
  const advancePaymentItems = quote?.advancePaymentItems?.filter((item) => item.advancePaymentAmount > 0) ?? [];
  const ready = !directLoading && (directLine ? true : cartReady);
  const canPlaceOrder =
    !placingOrder &&
    !quoteLoading &&
    !quote?.invalidItems.length &&
    Boolean(paymentMethods.length) &&
    Boolean(deliveryMethods.length) &&
    (!requiresDeliveryZoneSelection || Boolean(deliveryZoneCode));

  function chooseAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = addresses.find((item) => item.id === addressId);
    if (address) {
      setShippingLine1(address.line1);
      setShippingLine2(address.line2 ?? "");
      setShippingArea(address.area ?? "");
      setShippingCity(address.city);
      setShippingPostalCode(address.postalCode ?? "");
    }
  }

  function changeCheckoutLineQuantity(line: CartLine, quantity: number) {
    const id = checkoutLineId(line);
    const available = line.variant?.inventory ?? line.product.inventory;
    if (directLine) {
      if (quantity < 1) {
        setDirectLine(null);
        return;
      }
      setDirectLine({ ...line, quantity: Math.min(quantity, available) });
      return;
    }
    updateQuantity(id, quantity);
  }

  function removeCheckoutLine(line: CartLine) {
    if (directLine) {
      setDirectLine(null);
      return;
    }
    removeItem(checkoutLineId(line));
  }

  useEffect(() => {
    if (!ready || !checkoutLines.length) {
      setQuote(null);
      return;
    }
    if (requiresDeliveryZoneSelection && !deliveryZoneCode) {
      setQuote(null);
      setQuoteLoading(false);
      setNotice("");
      return;
    }
    let active = true;
    setQuoteLoading(true);
    fetchCheckoutQuote({
      items: checkoutLines.map((line) => ({
        productId: line.product.id,
        variantId: line.variant?.id,
        quantity: line.quantity
      })),
      promotionCode: promotion?.code,
      paymentMethod: selectedPaymentMethodCode,
      deliveryMethodCode,
      deliveryZoneCode,
      shippingInfo: {
        recipient: user?.name ?? "Customer",
        phone: user?.phone ?? "",
        email: user?.email,
        line1: shippingLine1 || "Address pending",
        line2: shippingLine2 || undefined,
        area: shippingArea || undefined,
        city: shippingCity || "Dhaka",
        postalCode: shippingPostalCode || undefined,
        note: shippingNote || undefined
      }
    })
      .then((result) => {
        if (!active) return;
        setQuote(result);
        const nextPaymentCode =
          result.selectedPaymentMethod && isOnlinePaymentGroup(result.selectedPaymentMethod) && onlineProviderMethods[0]
            ? onlineProviderMethods[0].code
            : result.selectedPaymentMethod?.code;
        if (nextPaymentCode && nextPaymentCode !== paymentMethodCode) {
          setPaymentMethodCode(nextPaymentCode);
        }
        if (result.selectedDeliveryMethod?.code && result.selectedDeliveryMethod.code !== deliveryMethodCode) {
          setDeliveryMethodCode(result.selectedDeliveryMethod.code);
        }
        if (result.invalidItems.length) setNotice(result.invalidItems[0].reason);
        else setNotice("");
      })
      .catch((caught) => {
        if (!active) return;
        setQuote(null);
        setNotice(caught instanceof Error ? caught.message : "Could not calculate checkout options.");
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    checkoutLines,
    deliveryMethodCode,
    deliveryZoneCode,
    paymentMethodCode,
    requiresDeliveryZoneSelection,
    selectedPaymentMethodCode,
    promotion?.code,
    ready,
    shippingArea,
    shippingCity,
    shippingLine1,
    shippingLine2,
    shippingNote,
    shippingPostalCode,
    user?.email,
    user?.name,
    user?.phone
  ]);

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
    if (requiresDeliveryZoneSelection && !deliveryZoneCode) {
      setNotice("Choose your delivery area before placing the order.");
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
      const shippingInfo: AddressInfo = {
        recipient: String(form.get("customerName")),
        phone: String(form.get("phone")),
        email: String(form.get("email")),
        line1: String(form.get("shippingLine1")),
        line2: String(form.get("shippingLine2") || "") || undefined,
        area: String(form.get("shippingArea") || "") || undefined,
        city: String(form.get("shippingCity") || "Dhaka"),
        postalCode: String(form.get("shippingPostalCode") || "") || undefined,
        note: String(form.get("shippingNote") || "") || undefined
      };
      const billingInfo: AddressInfo = billingSameAsShipping
        ? shippingInfo
        : {
            recipient: String(form.get("billingName")),
            phone: String(form.get("billingPhone")),
            email: String(form.get("billingEmail") || form.get("email")),
            line1: String(form.get("billingLine1")),
            line2: String(form.get("billingLine2") || "") || undefined,
            area: String(form.get("billingArea") || "") || undefined,
            city: String(form.get("billingCity") || shippingInfo.city),
            postalCode: String(form.get("billingPostalCode") || "") || undefined
          };
      const created = await createCheckout({
        customerName: String(form.get("customerName")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        shippingAddress: formatAddressInfo(shippingInfo),
        shippingInfo,
        billingInfo,
        billingSameAsShipping,
        addressId: selectedAddressId || undefined,
        promotionCode: promotion?.code,
        paymentMethod: selectedPaymentMethodCode,
        deliveryMethodCode,
        deliveryZoneCode,
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

      const pendingGateway = created.payments?.find((payment) => payment.status === "PENDING");
      const shouldStartBkash =
        pendingGateway?.provider === "bkash" ||
        ["BKASH", "ONLINE_PAYMENT"].includes(selectedPaymentMethodCode);

      if (shouldStartBkash) {
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
                    <div className="checkout-line-controls" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => changeCheckoutLineQuantity(line, line.quantity - 1)}
                        aria-label={`Decrease ${line.product.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <b>{line.quantity}</b>
                      <button
                        type="button"
                        onClick={() => changeCheckoutLineQuantity(line, line.quantity + 1)}
                        disabled={line.quantity >= (line.variant?.inventory ?? line.product.inventory)}
                        aria-label={`Increase ${line.product.name}`}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        className="checkout-line-remove"
                        onClick={() => removeCheckoutLine(line)}
                        aria-label={`Remove ${line.product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
              <strong>{quoteLoading ? "Checking..." : shippingFee ? formatMoney(shippingFee) : "Free"}</strong>
            </div>
            <div className="cost-line grand-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
            {requiredPaymentPercent > 0 ? (
              <>
                {advancePaymentItems.length ? (
                  <div className="checkout-advance-breakdown">
                    <strong>Advance payment applies to</strong>
                    {advancePaymentItems.map((item) => (
                      <div key={`${item.productId}-${item.variantId ?? "base"}`}>
                        <span>{item.productName}</span>
                        <small>{item.advancePaymentPercent}% of {formatMoney(item.discountedLineTotal)}</small>
                        <b>{formatMoney(item.advancePaymentAmount)}</b>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="cost-line"><span>Pay now</span><strong>{formatMoney(amountDueNow)}</strong></div>
                <div className="cost-line"><span>Due on delivery</span><strong>{formatMoney(amountDueOnDelivery)}</strong></div>
                {quote?.advancePaymentSubtotal ? (
                  <p className="form-note">Advance is calculated only on products that require upfront payment.</p>
                ) : null}
              </>
            ) : null}
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
              {activeDeliveryZones.length ? (
                <label className="field-label">
                  Delivery area
                  <select value={deliveryZoneCode} onChange={(event) => setDeliveryZoneCode(event.target.value)} required>
                    <option value="">Choose delivery area</option>
                    {activeDeliveryZones.map((zone) => (
                      <option value={zone.code} key={zone.id}>
                        {zone.name}{zone.city ? ` / ${zone.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {quote?.deliveryZone ? <small>Matched zone: {quote.deliveryZone.name}</small> : null}
                  {!deliveryZoneCode ? <small>Required for delivery fee, payment availability, and service coverage.</small> : null}
                </label>
              ) : null}
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
              <label className="field-label">Address line 1<input name="shippingLine1" placeholder="House, road, building" value={shippingLine1} onChange={(event) => setShippingLine1(event.target.value)} required /></label>
              <label className="field-label">Address line 2<input name="shippingLine2" placeholder="Apartment, floor, landmark" value={shippingLine2} onChange={(event) => setShippingLine2(event.target.value)} /></label>
              <div className="form-grid">
                <label className="field-label">Area<input name="shippingArea" placeholder="Dhanmondi" value={shippingArea} onChange={(event) => setShippingArea(event.target.value)} /></label>
                <label className="field-label">City<input name="shippingCity" placeholder="Dhaka" value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} required /></label>
              </div>
              <div className="form-grid">
                <label className="field-label">Postal code<input name="shippingPostalCode" placeholder="1209" value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} /></label>
                <label className="field-label">Delivery note<input name="shippingNote" placeholder="Call before delivery" value={shippingNote} onChange={(event) => setShippingNote(event.target.value)} /></label>
              </div>
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
                  <select
                    value={paymentMode === "online" ? "ONLINE" : selectedCashMethod?.code ?? ""}
                    onChange={(event) => {
                      if (event.target.value === "ONLINE") {
                        setPaymentMethodCode(selectedOnlineMethod?.code ?? onlinePaymentMethods[0]?.code ?? onlineGroupMethod?.code ?? "");
                      } else {
                        setPaymentMethodCode(event.target.value);
                      }
                    }}
                  >
                    {requiredPaymentPercent <= 0 ? cashPaymentMethods.map((method) => (
                      <option value={method.code} key={method.id}>{method.name}</option>
                    )) : null}
                    {onlinePaymentMethods.length ? <option value="ONLINE">Online payment</option> : null}
                  </select>
                  {requiredPaymentPercent > 0 ? <small>Advance payment requires an online payment option.</small> : null}
                </label>
              ) : (
                <p className="detail-notice">No payment method is currently available. Please contact support.</p>
              )}
              {paymentMode === "online" && onlinePaymentMethods.length ? (
                <div className="online-payment-options">
                  <span>Pay online with</span>
                  <div>
                    {onlinePaymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        className={selectedPaymentMethodCode === method.code ? "active" : ""}
                        onClick={() => setPaymentMethodCode(method.code)}
                      >
                        <CreditCard size={15} />
                        {isOnlinePaymentGroup(method) ? "Gateway" : method.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                />
                Billing information is same as shipping
              </label>
              {!billingSameAsShipping ? (
                <fieldset className="checkout-billing-fields">
                  <legend>Billing information</legend>
                  <div className="form-grid">
                    <label className="field-label">Billing name<input name="billingName" defaultValue={user?.name ?? ""} required={!billingSameAsShipping} /></label>
                    <label className="field-label">Billing phone<input name="billingPhone" defaultValue={user?.phone ?? ""} required={!billingSameAsShipping} /></label>
                  </div>
                  <label className="field-label">Billing email<input name="billingEmail" type="email" defaultValue={user?.email ?? ""} /></label>
                  <label className="field-label">Billing address line 1<input name="billingLine1" required={!billingSameAsShipping} /></label>
                  <label className="field-label">Billing address line 2<input name="billingLine2" /></label>
                  <div className="form-grid">
                    <label className="field-label">Billing area<input name="billingArea" /></label>
                    <label className="field-label">Billing city<input name="billingCity" defaultValue={shippingCity} required={!billingSameAsShipping} /></label>
                  </div>
                  <label className="field-label">Billing postal code<input name="billingPostalCode" /></label>
                </fieldset>
              ) : null}
              {notice ? <p className="detail-notice">{notice}</p> : null}
              <button
                className="primary-action full"
                type="submit"
                disabled={!canPlaceOrder}
              >
                <CreditCard size={18} />
                {placingOrder ? "Placing order..." : requiredPaymentPercent > 0 ? `Pay ${formatMoney(amountDueNow)} now` : `Place order - ${formatMoney(total)}`}
              </button>
              <p className="form-note">Payment and delivery availability is checked from your selected delivery area.</p>
            </form>
          )}
        </section>
      )}
      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}
