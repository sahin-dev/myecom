"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
          setCartNotice("Your guest bag items were added to your account bag.");
          hadGuestItems.current = false;
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCartNotice(error instanceof Error ? error.message : "Your bag could not be loaded.");
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
            : "Your bag could not be synchronized. Please try again."
        );
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [cart, hydrated]);

  useEffect(() => {
    if (!cartToast) return;
    const timer = window.setTimeout(() => setCartToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [cartToast]);

  function addItem(product: Product, quantity = 1, variant?: ProductVariant | null) {
    const activeVariants = (product.variants ?? []).filter((item) => item.isActive);
    if (activeVariants.length && !variant && !isBaseProductEnabled(product)) {
      setCartNotice(`${product.name} requires an option selection.`);
      setIsOpen(false);
      window.location.assign(`/products/${product.slug}`);
      return;
    }
    const available = variant?.inventory ?? product.inventory;
    if (available < 1) return;
    setCartNotice("");
    setCartToast(
      `${quantity} x ${product.name}${variant ? ` (${variant.name})` : ""} added to your bag.`
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
    [cart, cartNotice, hydrated, isOpen]
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
  const { cartCount, cartReady, subtotal, setIsOpen } = useCart();
  const hasItems = cartCount > 0;

  return (
    <button
      className={`floating-cart ${hasItems ? "has-items" : "is-empty"}`}
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label={
        hasItems
          ? `Open shopping bag with ${cartCount} ${cartCount === 1 ? "item" : "items"}`
          : "Open empty shopping bag"
      }
    >
      <span className="floating-cart-art" aria-hidden="true" key={cartCount}>
        <ShoppingBag size={25} strokeWidth={1.7} />
        {hasItems ? <b>{cartCount > 99 ? "99+" : cartCount}</b> : <span />}
      </span>
      <span className="floating-cart-copy">
        <small>
          {!cartReady
            ? "Loading bag"
            : hasItems
              ? `${cartCount} ${cartCount === 1 ? "item" : "items"}`
              : "Bag is empty"}
        </small>
        <strong>{hasItems ? formatMoney(subtotal) : "Start shopping"}</strong>
      </span>
    </button>
  );
}

function CartDrawer() {
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
  const checkoutHref = cart.length ? "/checkout" : "#";
  const emptyCart = async () => {
    const confirmed = await confirm({
      title: "Empty your shopping bag?",
      description: `This removes all ${cart.length} ${cart.length === 1 ? "item" : "items"} from your bag. You can't undo it.`,
      confirmLabel: "Empty bag",
      tone: "danger"
    });
    if (confirmed) clearCart();
  };

  return (
    <>
      <aside className={`cart-drawer ${isOpen ? "open" : ""}`} aria-label="Shopping cart">
        <div className="drawer-header">
          <div>
            <span>Shopping bag</span>
            <strong>{cartCount} {cartCount === 1 ? "item" : "items"}</strong>
          </div>
          <div className="drawer-header-actions">
            {cart.length ? (
              <button className="clear-cart-button" type="button" onClick={() => void emptyCart()}>
                <Trash2 size={14} />
                Empty bag
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close shopping bag"
            >
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="drawer-lines">
          {cartNotice ? (
            <div className="cart-notice" role="status">
              <span>{cartNotice}</span>
              <button type="button" onClick={clearCartNotice} aria-label="Dismiss bag message">
                <X size={15} />
              </button>
            </div>
          ) : null}
          {cart.length ? (
            cart.map((line) => (
              <article className="cart-line" key={line.variant?.id ?? line.product.id}>
                <Link href={`/products/${line.product.slug}`} onClick={() => setIsOpen(false)}>
                  <ProductArt compact product={line.product} />
                </Link>
                <div className="cart-line-copy">
                  <Link href={`/products/${line.product.slug}`} onClick={() => setIsOpen(false)}>
                    <strong>{line.product.name}</strong>
                  </Link>
                  {line.variant ? <small>{line.variant.name}</small> : null}
                  <span>{formatMoney(line.variant?.price ?? line.product.price)}</span>
                  <div className="cart-line-actions">
                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variant?.id ?? line.product.id, line.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variant?.id ?? line.product.id, line.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="remove-line"
                      type="button"
                      onClick={() => removeItem(line.variant?.id ?? line.product.id)}
                      aria-label={`Remove ${line.product.name}`}
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
              <small>Your pantry bag</small>
              <strong>Ready when you are</strong>
              <p>Choose something useful for home and it will wait for you here.</p>
              <Link className="primary-action" href="/shop" onClick={() => setIsOpen(false)}>
                Explore products
              </Link>
            </div>
          )}
        </div>
        {cart.length ? (
          <div className="drawer-footer">
            <div className="drawer-total">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <Link
              className="primary-action full"
              href={checkoutHref}
              onClick={() => setIsOpen(false)}
            >
              Continue to checkout
            </Link>
            <small>Delivery is calculated at checkout.</small>
          </div>
        ) : null}
      </aside>
      {isOpen ? (
        <button
          className="scrim"
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close cart"
        />
      ) : null}
    </>
  );
}
