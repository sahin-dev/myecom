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
import { useLocale, useTranslations } from "next-intl";
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
  resolveMediaUrl,
  trackAnalyticsEvent,
  validatePromotion
} from "../lib/catalog";
import { AppLocale, localeCode, localizedHref, localizeCatalog, localizeProduct } from "../lib/i18n";
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

type CheckoutSource = "cart" | "buy-now";

function rememberGatewayCheckoutSource(paymentID: string | null | undefined, source: CheckoutSource) {
  if (!paymentID || typeof window === "undefined") return;
  window.sessionStorage.setItem(`checkout-source:${paymentID}`, source);
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
  const paymentKind = cleanPaymentCode(String(method.metadata?.paymentKind ?? ""));
  if (paymentKind === "GATEWAY") return true;
  const provider = cleanPaymentCode(String(method.metadata?.provider ?? ""));
  const value = `${cleanPaymentCode(method.code)} ${cleanPaymentCode(method.name)} ${provider}`;
  return ["BKASH", "NAGAD", "CARD", "SSLCOMMERZ", "STRIPE"].some((token) => value.includes(token));
}

function isBkashPaymentMethod(method?: { code?: string; name?: string; metadata?: Record<string, unknown> | null } | null) {
  if (!method) return false;
  const provider = cleanPaymentCode(String(method.metadata?.provider ?? ""));
  const value = `${cleanPaymentCode(method.code)} ${cleanPaymentCode(method.name)} ${provider}`;
  return value.includes("BKASH");
}

function paymentProviderKey(method?: { code?: string; name?: string; metadata?: Record<string, unknown> | null } | null) {
  if (!method) return "gateway";
  const provider = cleanPaymentCode(String(method.metadata?.provider ?? ""));
  const value = `${cleanPaymentCode(method.code)} ${cleanPaymentCode(method.name)} ${provider}`;
  if (value.includes("BKASH")) return "bkash";
  if (value.includes("NAGAD")) return "nagad";
  if (value.includes("CARD") || value.includes("SSLCOMMERZ") || value.includes("STRIPE")) return "card";
  return "gateway";
}

function paymentLogoUrl(method?: { metadata?: Record<string, unknown> | null } | null) {
  const logo = typeof method?.metadata?.logoUrl === "string" ? method.metadata.logoUrl : "";
  return resolveMediaUrl(logo);
}

function PaymentMethodLogo({
  method
}: {
  method: { code?: string; name?: string; metadata?: Record<string, unknown> | null };
}) {
  const uploadedLogo = paymentLogoUrl(method);
  if (uploadedLogo) {
    return (
      <span className="payment-provider-logo uploaded" aria-hidden="true">
        <img src={uploadedLogo} alt="" />
      </span>
    );
  }
  const provider = paymentProviderKey(method);
  const label =
    provider === "bkash" ? "bKash" :
    provider === "nagad" ? "Nagad" :
    provider === "card" ? "Card" :
    "Pay";
  return (
    <span className={`payment-provider-logo ${provider}`} aria-hidden="true">
      {label}
    </span>
  );
}

export function CheckoutPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Checkout");
  const common = useTranslations("Common");
  const cartText = useTranslations("Cart");
  const money = (value: number) => formatMoney(value, localeCode(locale));
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [directLine, setDirectLine] = useState<CartLine | null>(null);
  const [checkoutSource, setCheckoutSource] = useState<CheckoutSource>("cart");
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
  const [paymentAmountMode, setPaymentAmountMode] = useState<"minimum" | "full">("minimum");
  const [deliveryMethodCode, setDeliveryMethodCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [notice, setNotice] = useState("");
  const { cart, cartReady, clearCart, updateQuantity, removeItem } = useCart();
  const { user, requireAuth } = useAuth();

  useEffect(() => {
    fetchCatalog()
      .then((result) => {
        const localized = localizeCatalog(result, locale);
        setCatalog(localized);
        setPaymentMethodCode(
          localized.checkoutMethods.find((method) => method.type === "PAYMENT" && method.isActive)?.code ?? ""
        );
        setDeliveryMethodCode(
          localized.checkoutMethods.find((method) => method.type === "DELIVERY" && method.isActive)?.code ?? ""
        );
      })
      .catch(() => setCatalog(localizeCatalog(fallbackCatalog, locale)));

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get("product");
    const source: CheckoutSource = productSlug || params.get("source") === "buy-now" ? "buy-now" : "cart";
    setCheckoutSource(source);
    if (!productSlug) {
      setDirectLoading(false);
      return;
    }

    fetchProduct(productSlug)
      .then((rawProduct) => {
        const product = localizeProduct(rawProduct, locale);
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
  }, [locale]);

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
    () => checkoutSource === "buy-now" ? (directLine ? [directLine] : []) : cart,
    [cart, checkoutSource, directLine]
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
  const selectedPaymentForDescription =
    paymentMode === "online" ? selectedOnlineMethod ?? onlineGroupMethod : selectedCashMethod;
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
  const minimumPayNowAmount = quote?.amountDueNow ?? 0;
  const canChoosePaymentAmount =
    paymentMode === "online" &&
    requiredPaymentPercent > 0 &&
    minimumPayNowAmount > 0 &&
    minimumPayNowAmount < total;
  const payNowAmount =
    paymentMode === "online"
      ? canChoosePaymentAmount && paymentAmountMode === "minimum"
        ? minimumPayNowAmount
        : total
      : minimumPayNowAmount;
  const dueOnDeliveryAmount = Math.max(total - payNowAmount, 0);
  const advancePaymentItems = quote?.advancePaymentItems?.filter((item) => item.advancePaymentAmount > 0) ?? [];
  const ready = checkoutSource === "buy-now" ? !directLoading : cartReady;
  const canPlaceOrder =
    !placingOrder &&
    !quoteLoading &&
    !quote?.invalidItems.length &&
    Boolean(paymentMethods.length) &&
    Boolean(deliveryMethods.length) &&
    (!requiresDeliveryZoneSelection || Boolean(deliveryZoneCode));

  useEffect(() => {
    setPaymentAmountMode(canChoosePaymentAmount ? "minimum" : "full");
  }, [canChoosePaymentAmount, minimumPayNowAmount, total]);

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
        const resultPaymentMethods = result.paymentMethods;
        const resultOnlineProviderMethods = resultPaymentMethods.filter(isOnlinePaymentProvider);
        const resultOnlineGroupMethod = resultPaymentMethods.find(isOnlinePaymentGroup);
        const resultOnlineMethods = resultOnlineProviderMethods.length
          ? resultOnlineProviderMethods
          : resultOnlineGroupMethod
            ? [resultOnlineGroupMethod]
            : resultPaymentMethods.filter((method) => !isCashPaymentMethod(method));
        const currentOnlineMethod = resultOnlineMethods.find((method) => method.code === paymentMethodCode);
        const nextPaymentCode =
          currentOnlineMethod?.code ??
          (
            result.selectedPaymentMethod && isOnlinePaymentGroup(result.selectedPaymentMethod) && resultOnlineProviderMethods[0]
              ? resultOnlineProviderMethods[0].code
              : result.selectedPaymentMethod?.code
          );
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
        locale,
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
        payNowAmount: paymentMode === "online" ? payNowAmount : undefined,
        deliveryMethodCode,
        deliveryZoneCode,
        sessionKey: analyticsSessionKey(),
        idempotencyKey: window.crypto.randomUUID(),
        checkoutSource,
        items: checkoutLines.map((line) => ({
          productId: line.product.id,
          variantId: line.variant?.id,
          quantity: line.quantity
        }))
      });
      const pendingGateway = created.payments?.find((payment) => payment.status === "PENDING");
      const shouldStartBkash =
        paymentMode === "online" &&
        (pendingGateway?.provider === "bkash" || isBkashPaymentMethod(selectedOnlineMethod));

      if (shouldStartBkash) {
        try {
          setNotice("Opening secure bKash payment...");
          const preparedUrl =
            typeof pendingGateway?.providerPayload?.bkashURL === "string"
              ? pendingGateway.providerPayload.bkashURL
              : "";
          let paymentID = pendingGateway?.gatewayReference;
          let bkashURL = preparedUrl;
          if (!bkashURL) {
            const initiated = await initiateBkashPayment(created.id);
            paymentID = initiated.paymentID;
            bkashURL = initiated.bkashURL;
          }
          rememberGatewayCheckoutSource(paymentID, checkoutSource);
          window.location.href = bkashURL;
          return;
        } catch (bkashError) {
          setNotice(
            bkashError instanceof Error
              ? bkashError.message
              : "This payment method could not be processed right now. Select another payment method or try again."
          );
          return;
        }
      }

      setOrder(created);
      if (checkoutSource === "cart") clearCart();
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
        <a href={localizedHref(checkoutSource === "buy-now" && directLine ? `/products/${directLine.product.slug}` : "/shop", locale)}>
          <ArrowLeft size={16} /> {common("continueShopping")}
        </a>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>

      {!ready ? (
        <div className="checkout-empty">Preparing your order...</div>
      ) : !checkoutLines.length ? (
        <section className="checkout-empty">
          <ShoppingBag size={32} />
          <h2>{t("emptyTitle")}</h2>
          <p>{t("emptyDetail")}</p>
          <a className="primary-action" href={localizedHref("/shop", locale)}>{common("shop")}</a>
        </section>
      ) : (
        <section className="product-checkout-section checkout-page-shell">
          <div className="checkout-summary">
            <p className="eyebrow">{t("summary")}</p>
            <h2>{cartText("itemCount", { count: checkoutLines.length })}</h2>
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
                      {common("quantity")}: {line.quantity}
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
                    {money((line.variant?.price ?? line.product.price) * line.quantity)}
                  </strong>
                </div>
              ))}
            </div>
            <form className="promotion-form" onSubmit={applyPromotion}>
              <input
                aria-label={t("promotionCode")}
                value={promotionCode}
                onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                placeholder={t("promotionCode")}
                required
              />
              <button className="secondary-action" type="submit">{common("apply")}</button>
            </form>
            {promotionNotice ? <p className="form-note">{promotionNotice}</p> : null}
            <div className="cost-line"><span>{common("subtotal")}</span><strong>{money(subtotal)}</strong></div>
            {discount > 0 ? (
              <div className="cost-line discount"><span>Offer</span><strong>-{formatMoney(discount)}</strong></div>
            ) : null}
            <div className="cost-line">
              <span>{common("delivery")}</span>
              <strong>{quoteLoading ? t("placingOrder") : shippingFee ? money(shippingFee) : "Free"}</strong>
            </div>
            <div className="cost-line grand-total"><span>{common("total")}</span><strong>{money(total)}</strong></div>
            {paymentMode === "online" ? (
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
                {canChoosePaymentAmount ? (
                  <div className="checkout-payment-choice" role="radiogroup" aria-label="Choose payment amount">
                    <button
                      type="button"
                      className={paymentAmountMode === "minimum" ? "active" : ""}
                      onClick={() => setPaymentAmountMode("minimum")}
                    >
                      <span>{t("minimumAdvance")}</span>
                      <strong>{money(minimumPayNowAmount)}</strong>
                      <small>Pay the required amount now</small>
                    </button>
                    <button
                      type="button"
                      className={paymentAmountMode === "full" ? "active" : ""}
                      onClick={() => setPaymentAmountMode("full")}
                    >
                      <span>{t("fullPayment")}</span>
                      <strong>{money(total)}</strong>
                      <small>Clear the full order online</small>
                    </button>
                  </div>
                ) : null}
                <div className="cost-line"><span>{t("payNow")}</span><strong>{money(payNowAmount)}</strong></div>
                <div className="cost-line"><span>{t("dueDelivery")}</span><strong>{money(dueOnDeliveryAmount)}</strong></div>
                {quote?.advancePaymentSubtotal ? (
                  <p className="form-note">
                    Minimum advance is calculated only on products that require upfront payment.
                  </p>
                ) : (
                  <p className="form-note">Online payment will be collected before this order is confirmed for processing.</p>
                )}
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
              <header className="checkout-details-head">
                <div>
                  <p className="eyebrow">{t("deliveryDetails")}</p>
                  <h2>{t("sendTo")}</h2>
                </div>
                <span>{deliveryZoneCode ? t("deliveryArea") : t("areaRequired")}</span>
              </header>
              {!user ? (
                <div className="checkout-guest-prompt">
                  <span>Have an account? Sign in for a faster checkout with saved details.</span>
                  <button type="button" className="text-link" onClick={() => requireAuth(() => {})}>
                    Sign in
                  </button>
                </div>
              ) : null}
              <div className="checkout-address-scroll">
                <section className="checkout-field-card">
                  <header>
                    <span>1</span>
                    <div><strong>Contact</strong><small>For delivery updates and confirmation</small></div>
                  </header>
                  <div className="form-grid">
                    <label className="field-label">{t("fullName")}<input name="customerName" placeholder={t("fullName")} defaultValue={user?.name ?? ""} required /></label>
                    <label className="field-label">{t("phone")}<input name="phone" placeholder={t("phone")} defaultValue={user?.phone ?? ""} required /></label>
                  </div>
                  <label className="field-label">{t("email")}<input name="email" type="email" placeholder={t("email")} defaultValue={user?.email ?? ""} required /></label>
                </section>

                <section className="checkout-field-card">
                  <header>
                    <span>2</span>
                    <div><strong>Shipping address</strong><small>Used for service area and delivery fee</small></div>
                  </header>
                  {activeDeliveryZones.length ? (
                    <label className="field-label">
                      {t("deliveryArea")}
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
                      {t("savedAddress")}
                      <select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}>
                        {addresses.map((address) => (
                          <option value={address.id} key={address.id}>
                            {address.label} / {address.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="field-label">{t("address1")}<input name="shippingLine1" placeholder={t("address1")} value={shippingLine1} onChange={(event) => setShippingLine1(event.target.value)} required /></label>
                  <label className="field-label">{t("address2")}<input name="shippingLine2" placeholder={t("address2")} value={shippingLine2} onChange={(event) => setShippingLine2(event.target.value)} /></label>
                  <div className="form-grid">
                    <label className="field-label">Area<input name="shippingArea" placeholder="Dhanmondi" value={shippingArea} onChange={(event) => setShippingArea(event.target.value)} /></label>
                    <label className="field-label">City<input name="shippingCity" placeholder="Dhaka" value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} required /></label>
                  </div>
                  <div className="form-grid">
                    <label className="field-label">Postal code<input name="shippingPostalCode" placeholder="1209" value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} /></label>
                    <label className="field-label">Delivery note<input name="shippingNote" placeholder="Call before delivery" value={shippingNote} onChange={(event) => setShippingNote(event.target.value)} /></label>
                  </div>
                </section>

                <section className="checkout-field-card">
                  <header>
                    <span>3</span>
                    <div><strong>Billing</strong><small>Use the same details or add billing info</small></div>
                  </header>
                  <label className="checkout-billing-toggle">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                    />
                    {t("billingSame")}
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
                </section>
              </div>
              <section className="checkout-options-panel">
                <header>
                  <strong>{t("deliveryPayment")}</strong>
                  <small>Choose the service and checkout method for this order</small>
                </header>
                <div className="checkout-options-grid">
                  {deliveryMethods.length ? (
                    <label className="field-label checkout-method-card">
                      {t("deliveryMethod")}
                      <select value={deliveryMethodCode || deliveryMethods[0].code} onChange={(event) => setDeliveryMethodCode(event.target.value)}>
                        {deliveryMethods.map((method) => (
                          <option value={method.code} key={method.id}>
                            {method.name}{method.fee ? ` / ${formatMoney(method.fee)}` : " / Free"}
                          </option>
                        ))}
                      </select>
                      <small>{selectedDelivery?.description ?? "Choose the delivery service for this address."}</small>
                    </label>
                  ) : null}
                  {paymentMethods.length ? (
                    <label className="field-label checkout-method-card">
                      {t("paymentMethod")}
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
                      <small>
                        {requiredPaymentPercent > 0
                          ? "Advance payment requires an online payment option."
                          : selectedPaymentForDescription?.description ?? "Choose how this order should be paid."}
                      </small>
                    </label>
                  ) : (
                    <p className="detail-notice">No payment method is currently available. Please contact support.</p>
                  )}
                </div>
                {paymentMode === "online" && onlinePaymentMethods.length ? (
                  <div className="online-payment-options">
                    <span>{t("payOnlineWith")}</span>
                    <div className="form-grid">
                      {onlinePaymentMethods.map((method) => (
                        paymentLogoUrl(method) ? (
                          <button
                            key={method.id}
                            type="button"
                            className={[
                              "logo-only",
                              selectedPaymentMethodCode === method.code ? "active" : ""
                            ].filter(Boolean).join(" ")}
                            onClick={() => setPaymentMethodCode(method.code)}
                            aria-label={isOnlinePaymentGroup(method) ? "Gateway" : method.name}
                            aria-pressed={selectedPaymentMethodCode === method.code}
                            title={isOnlinePaymentGroup(method) ? "Gateway" : method.name}
                          >
                            <PaymentMethodLogo method={method} />
                            {selectedPaymentMethodCode === method.code ? <span className="selected-payment-mark">Selected</span> : null}
                          </button>
                        ) : (
                          <button
                            key={method.id}
                            type="button"
                            className={selectedPaymentMethodCode === method.code ? "active" : ""}
                            onClick={() => setPaymentMethodCode(method.code)}
                            aria-pressed={selectedPaymentMethodCode === method.code}
                          >
                            {isOnlinePaymentGroup(method) ? "Gateway" : method.name}
                            {selectedPaymentMethodCode === method.code ? <span className="selected-payment-mark">Selected</span> : null}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
              {notice ? <p className="detail-notice">{notice}</p> : null}
              <button
                className="primary-action full"
                type="submit"
                disabled={!canPlaceOrder}
              >
                <CreditCard size={18} />
                {placingOrder
                  ? t("placingOrder")
                  : paymentMode === "online"
                    ? `${t("payNow")} ${money(payNowAmount)}`
                    : `${t("placeOrder")} - ${money(total)}`}
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
