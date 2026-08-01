"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Product,
  addAccountWishlist,
  fetchAccountWishlist,
  fetchProduct,
  removeAccountWishlist,
  trackAnalyticsEvent
} from "../lib/catalog";
import { useAuth } from "./AuthContext";

type WishlistContextValue = {
  slugs: string[];
  savedCount: number;
  isSaved: (slug: string) => boolean;
  toggle: (product: Product | string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const legacyWishlistStorageKey = "my-ecom-wishlist";

async function migrateLegacyGuestWishlist() {
  const raw = window.localStorage.getItem(legacyWishlistStorageKey);
  window.localStorage.removeItem(legacyWishlistStorageKey);
  if (!raw) return;
  try {
    const slugs = JSON.parse(raw) as unknown;
    if (!Array.isArray(slugs) || !slugs.length) return;
    for (const slug of slugs) {
      if (typeof slug !== "string") continue;
      const product = await fetchProduct(slug).catch(() => null);
      if (product) await addAccountWishlist(product.id).catch(() => undefined);
    }
  } catch {
    // Unsalvageable legacy wishlist data - nothing to migrate.
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Array<{ product: Product }>>([]);
  const { user, loading: authLoading } = useAuth();
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const shouldMigrate = !user && !migrationAttempted.current;
    if (shouldMigrate) migrationAttempted.current = true;

    (shouldMigrate ? migrateLegacyGuestWishlist() : Promise.resolve())
      .catch(() => undefined)
      .then(() => fetchAccountWishlist())
      .then((serverItems) => {
        if (active) setItems(serverItems);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  const value = useMemo(
    () => ({
      slugs: items.map((item) => item.product.slug),
      savedCount: items.length,
      isSaved: (slug: string) => items.some((item) => item.product.slug === slug),
      toggle: (input: Product | string) => {
        const slug = typeof input === "string" ? input : input.slug;
        const product =
          typeof input === "string"
            ? items.find((item) => item.product.slug === input)?.product
            : input;
        if (!product) return;
        const removing = items.some((item) => item.product.slug === slug);
        setItems((current) =>
          removing ? current.filter((item) => item.product.slug !== slug) : [...current, { product }]
        );
        void (removing ? removeAccountWishlist(product.id) : addAccountWishlist(product.id)).catch(() => {
          setItems((current) =>
            removing
              ? [...current, { product }]
              : current.filter((item) => item.product.slug !== slug)
          );
        });
        if (!removing) {
          void trackAnalyticsEvent({ type: "WISHLIST_ADDED", productId: product.id });
        }
      }
    }),
    [items]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider.");
  return context;
}
