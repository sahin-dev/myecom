"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Product,
  addAccountWishlist,
  fallbackProducts,
  fetchAccountWishlist,
  removeAccountWishlist,
  searchCatalog,
  trackAnalyticsEvent
} from "../lib/catalog";
import { useAuth } from "./AuthContext";

type WishlistContextValue = {
  slugs: string[];
  isSaved: (slug: string) => boolean;
  toggle: (product: Product | string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const wishlistStorageKey = "my-ecom-wishlist";
const isDatabaseId = (value: string) => /^[a-f0-9]{24}$/i.test(value);

async function liveProductId(product: Product) {
  if (isDatabaseId(product.id)) return product.id;
  const result = await searchCatalog({ search: product.name, limit: 20 });
  return result.products.find((item) => item.slug === product.slug)?.id;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(wishlistStorageKey);
      if (saved) setSlugs(JSON.parse(saved) as string[]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(wishlistStorageKey, JSON.stringify(slugs));
    }
  }, [hydrated, slugs]);

  useEffect(() => {
    if (!user || !hydrated) return;
    fetchAccountWishlist().then(async (items) => {
      const remote = items.map((item) => item.product.slug);
      const merged = [...new Set([...remote, ...slugs])];
      setSlugs(merged);
      const localOnly = slugs.filter((slug) => !remote.includes(slug));
      if (localOnly.length) {
        const result = await searchCatalog({ limit: 100 });
        await Promise.all(localOnly.map((slug) => {
          const product = result.products.find((item) => item.slug === slug);
          return product ? addAccountWishlist(product.id) : Promise.resolve();
        }));
      }
    }).catch(() => undefined);
  }, [hydrated, user?.id]);

  const value = useMemo(
    () => ({
      slugs,
      isSaved: (slug: string) => slugs.includes(slug),
      toggle: (input: Product | string) => {
        const slug = typeof input === "string" ? input : input.slug;
        const product =
          typeof input === "string"
            ? fallbackProducts.find((item) => item.slug === input)
            : input;
        const removing = slugs.includes(slug);
        setSlugs((current) =>
          removing ? current.filter((item) => item !== slug) : [...current, slug]
        );
        if (user && product) {
          void liveProductId(product).then((productId) => {
            if (!productId) return;
            return removing
              ? removeAccountWishlist(productId)
              : addAccountWishlist(productId);
          });
        }
        if (!removing && product && isDatabaseId(product.id)) {
          void trackAnalyticsEvent({ type: "WISHLIST_ADDED", productId: product.id });
        }
      }
    }),
    [slugs, user]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider.");
  return context;
}
