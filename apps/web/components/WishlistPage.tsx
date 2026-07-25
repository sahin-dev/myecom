"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Catalog,
  Product,
  fallbackCatalog,
  fetchAccountWishlist,
  fetchCatalog,
  formatMoney,
  searchCatalog
} from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useWishlist } from "./WishlistContext";

export function WishlistPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [products, setProducts] = useState<Product[]>([]);
  const { user } = useAuth();
  const { slugs, toggle } = useWishlist();
  const { addItem } = useCart();

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(() => setCatalog(fallbackCatalog));
  }, []);

  useEffect(() => {
    if (!slugs.length) {
      setProducts([]);
      return;
    }

    const request = user
      ? fetchAccountWishlist().then((items) => items.map((item) => item.product))
      : searchCatalog({ limit: 100 }).then((result) =>
          result.products.filter((product) => slugs.includes(product.slug))
        );
    request.then(setProducts).catch(() => setProducts([]));
  }, [slugs, user]);

  return (
    <main>
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} />
      <section className="wishlist-hero">
        <p className="eyebrow">Saved for later</p>
        <h1>Your wishlist</h1>
        <p>Keep useful pantry picks close while you decide.</p>
      </section>
      <section className="wishlist-content">
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="card-topline">
                  <span>{product.category?.name ?? "Pantry"}</span>
                  <button type="button" onClick={() => toggle(product)} aria-label="Remove from wishlist">
                    <Heart size={17} fill="currentColor" />
                  </button>
                </div>
                <a href={`/products/${product.slug}`}><ProductArt product={product} /></a>
                <div className="product-meta">
                  <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
                  <div className="price-row"><strong>{formatMoney(product.price)}</strong></div>
                </div>
                {product.variants?.length ? (
                  <QuickVariantAdd product={product} />
                ) : (
                  <button className="add-button full" type="button" onClick={() => addItem(product)}>
                    <ShoppingBag size={17} />
                    Add to bag
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="wishlist-empty">
            <Heart size={40} strokeWidth={1.4} />
            <h2>Nothing saved yet</h2>
            <p>Use the heart button on a product to keep it here.</p>
            <a className="primary-action" href="/shop">Browse products</a>
          </div>
        )}
      </section>
      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}
