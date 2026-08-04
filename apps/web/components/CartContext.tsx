"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CartLine,
  Product,
  ProductVariant,
  fetchAccountCart,
  formatMoney,
  isBaseProductEnabled,
  saveAccountCart,
  trackAnalyticsEvent
} from "../lib/catalog";
import { AppLocale, localeCode, localizedHref } from "../lib/i18n";
import { useAuth } from "./AuthContext";
import { ProductArt } from "./ProductArt";
import { useConfirm } from "./ui/ConfirmDialog";

type CartContextValue = {
  cart: CartLine[];
  cartReady: boolean;
  cartCount: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  cartNotice: string;
  clearCartNotice: () => void;
  addItem: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const legacyCartStorageKey = "my-ecom-cart";
const legacyCartOwnerStorageKey = "my-ecom-cart-owner";

async function migrateLegacyGuestCart() {
  const raw = window.localStorage.getItem(legacyCartStorageKey);
  window.localStorage.removeItem(legacyCartStorageKey);
  window.localStorage.removeItem(legacyCartOwnerStorageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return;
    const items = (parsed as CartLine[])
      .filter((line) => line?.product?.id && Number.isFinite(line.quantity) && line.quantity > 0)
      .map((line) => ({
        productId: line.product.id,
        variantId: line.variant?.id,
        quantity: line.quantity
      }));
    if (items.length) await saveAccountCart(items);
  } catch {
    // Unsalvageable legacy cart data - nothing to migrate.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Cart");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [cartToast, setCartToast] = useState("");
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const previousUserId = useRef<string | null>(null);
  const skipNextSave = useRef(false);
  const hadGuestItems = useRef(false);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const justLoggedIn = Boolean(user) && !previousUserId.current;
    const shouldMigrate = !user && !migrationAttempted.current;
    if (shouldMigrate) migrationAttempted.current = true;

    (shouldMigrate ? migrateLegacyGuestCart() : Promise.resolve())
      .catch(() => undefined)
      .then(() => fetchAccountCart())
      .then((serverCart) => {
        if (!active) return;
        const lines: CartLine[] = [];
        let hadDuplicates = false;
        for (const item of serverCart.items) {
          const key = item.variant?.id ?? item.product.id;
          const existing = lines.find((line) => (line.variant?.id ?? line.product.id) === key);
          if (existing) {
            existing.quantity += item.quantity;
            hadDuplicates = true;
          } else {
            lines.push({ product: item.product, variant: item.variant, quantity: item.quantity });
          }
        }
        skipNextSave.current = !hadDuplicates;
        setCart(lines);
        if (justLoggedIn && hadGuestItems.current) {
          setCartNotice(t("guestMerged"));
          hadGuestItems.current = false;
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCartNotice(error instanceof Error ? error.message : t("loadError"));
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    const currentUserId = user?.id ?? null;
    if (!previousUserId.current && currentUserId) {
      hadGuestItems.current = cart.length > 0;
    }
    if (previousUserId.current && !currentUserId) {
      setCart([]);
    }
    previousUserId.current = currentUserId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      void saveAccountCart(
        cart.map((line) => ({
          productId: line.product.id,
          variantId: line.variant?.id,
          quantity: line.quantity
        }))
      ).catch((error: unknown) => {
        setCartNotice(
          error instanceof Error
            ? error.message
            : t("syncError")
        );
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [cart, hydrated, t]);

  useEffect(() => {
    if (!cartToast) return;
    const timer = window.setTimeout(() => setCartToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [cartToast]);

  function addItem(product: Product, quantity = 1, variant?: ProductVariant | null) {
    const activeVariants = (product.variants ?? []).filter((item) => item.isActive);
    if (activeVariants.length && !variant && !isBaseProductEnabled(product)) {
      setCartNotice(t("optionRequired", { product: product.name }));
      setIsOpen(false);
      window.location.assign(localizedHref(`/products/${product.slug}`, locale));
      return;
    }
    const available = variant?.inventory ?? product.inventory;
    if (available < 1) return;
    setCartNotice("");
    setCartToast(
      t("added", { quantity, product: `${product.name}${variant ? ` (${variant.name})` : ""}` })
    );
    const lineId = variant?.id ?? product.id;
    setCart((current) => {
      const existing = current.find((line) => (line.variant?.id ?? line.product.id) === lineId);
      if (!existing) return [...current, { product, variant, quantity }];
      return current.map((line) =>
        (line.variant?.id ?? line.product.id) === lineId
          ? {
              ...line,
              quantity: Math.min(line.quantity + quantity, available)
            }
          : line
      );
    });
    void trackAnalyticsEvent({
      type: "ADDED_TO_CART",
      productId: product.id,
      metadata: { variantId: variant?.id, quantity }
    });
  }

  function updateQuantity(lineId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          (line.variant?.id ?? line.product.id) === lineId
            ? {
                ...line,
                quantity: Math.min(quantity, line.variant?.inventory ?? line.product.inventory)
              }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  function removeItem(lineId: string) {
    const line = cart.find((item) => (item.variant?.id ?? item.product.id) === lineId);
    setCart((current) =>
      current.filter((item) => (item.variant?.id ?? item.product.id) !== lineId)
    );
    if (line) {
      void trackAnalyticsEvent({ type: "REMOVED_FROM_CART", productId: line.product.id });
    }
  }

  const value = useMemo(
    () => ({
      cart,
      cartReady: hydrated,
      cartCount: cart.reduce((total, line) => total + line.quantity, 0),
      subtotal: cart.reduce(
        (total, line) => total + (line.variant?.price ?? line.product.price) * line.quantity,
        0
      ),
      isOpen,
      setIsOpen,
      cartNotice,
      clearCartNotice: () => setCartNotice(""),
      addItem,
      updateQuantity,
      removeItem,
      clearCart: () => setCart([])
    }),
    [cart, cartNotice, hydrated, isOpen, locale, t]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {!isAdminRoute ? (
        <>
          <CartToast message={cartToast} />
          <FloatingCartButton />
          <CartDrawer />
        </>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}

function CartToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="cart-toast" role="status" aria-live="polite">
      <ShoppingBag size={18} />
      <span>{message}</span>
    </div>
  );
}

function FloatingCartButton() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Cart");
  const { cartCount, cartReady, subtotal, setIsOpen } = useCart();
  const hasItems = cartCount > 0;

  return (
    <button
      className={`floating-cart ${hasItems ? "has-items" : "is-empty"}`}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label={
        hasItems
          ? t("shoppingBag") + ` (${t("itemCount", { count: cartCount })})`
          : t("openEmpty")
      }
    >
      <span className="floating-cart-art" aria-hidden="true" key={cartCount}>
        <ShoppingBag size={25} strokeWidth={1.7} />
        {hasItems ? <b>{cartCount > 99 ? "99+" : cartCount}</b> : <span />}
      </span>
      <span className="floating-cart-copy">
        <small>
          {!cartReady
            ? t("loadingBag")
            : hasItems
              ? t("itemCount", { count: cartCount })
              : t("empty")}
        </small>
        <strong>{hasItems ? formatMoney(subtotal, localeCode(locale)) : t("startShopping")}</strong>
      </span>
    </button>
  );
}

function CartDrawer() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Cart");
  const common = useTranslations("Common");
  const {
    cart,
    cartCount,
    subtotal,
    isOpen,
    setIsOpen,
    cartNotice,
    clearCartNotice,
    updateQuantity,
    removeItem,
    clearCart
  } = useCart();
  const confirm = useConfirm();
  const checkoutHref = cart.length ? localizedHref("/checkout", locale) : "#";
  const emptyCart = async () => {
    const confirmed = await confirm({
      title: t("emptyConfirmTitle"),
      description: t("emptyConfirmDetail", { count: cart.length }),
      confirmLabel: t("clear"),
      tone: "danger"
    });
    if (confirmed) clearCart();
  };

  return (
    <>
      <aside className={`cart-drawer ${isOpen ? "open" : ""}`} aria-label={t("shoppingBag")}>
        <div className="drawer-header">
          <div>
            <span>{t("shoppingBag")}</span>
            <strong>{t("itemCount", { count: cartCount })}</strong>
          </div>
          <div className="drawer-header-actions">
            {cart.length ? (
              <button className="clear-cart-button" type="button" onClick={() => void emptyCart()}>
                <Trash2 size={14} />
                {t("clear")}
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("close")}
            >
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="drawer-lines">
          {cartNotice ? (
            <div className="cart-notice" role="status">
              <span>{cartNotice}</span>
              <button type="button" onClick={clearCartNotice} aria-label={t("dismiss")}>
                <X size={15} />
              </button>
            </div>
          ) : null}
          {cart.length ? (
            cart.map((line) => (
              <article className="cart-line" key={line.variant?.id ?? line.product.id}>
                <Link href={localizedHref(`/products/${line.product.slug}`, locale)} onClick={() => setIsOpen(false)}>
                  <ProductArt compact product={line.product} />
                </Link>
                <div className="cart-line-copy">
                  <Link href={localizedHref(`/products/${line.product.slug}`, locale)} onClick={() => setIsOpen(false)}>
                    <strong>{line.product.name}</strong>
                  </Link>
                  {line.variant ? <small>{line.variant.name}</small> : null}
                  <span>{formatMoney(line.variant?.price ?? line.product.price, localeCode(locale))}</span>
                  <div className="cart-line-actions">
                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variant?.id ?? line.product.id, line.quantity - 1)}
                        aria-label={t("decrease")}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variant?.id ?? line.product.id, line.quantity + 1)}
                        aria-label={t("increase")}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="remove-line"
                      type="button"
                      onClick={() => removeItem(line.variant?.id ?? line.product.id)}
                      aria-label={t("removeProduct", { product: line.product.name })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-cart">
              <div className="empty-cart-art" aria-hidden="true">
                <ShoppingBag size={46} strokeWidth={1.35} />
                <span />
              </div>
              <small>{t("pantryBag")}</small>
              <strong>{t("ready")}</strong>
              <p>{t("readyDetail")}</p>
              <Link className="primary-action" href={localizedHref("/shop", locale)} onClick={() => setIsOpen(false)}>
                {t("explore")}
              </Link>
            </div>
          )}
        </div>
        {cart.length ? (
          <div className="drawer-footer">
            <div className="drawer-total">
              <span>{common("subtotal")}</span>
              <strong>{formatMoney(subtotal, localeCode(locale))}</strong>
            </div>
            <Link
              className="primary-action full"
              href={checkoutHref}
              onClick={() => setIsOpen(false)}
            >
              {t("continueCheckout")}
            </Link>
            <small>{t("deliveryCalculated")}</small>
          </div>
        ) : null}
      </aside>
      {isOpen ? (
        <button
          className="scrim"
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={t("close")}
        />
      ) : null}
    </>
  );
}
