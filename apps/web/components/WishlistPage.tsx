"use client";

import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Catalog,
  Product,
  ProductVariant,
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

const wishlistPageSize = 12;

export function WishlistPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
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
  const pages = Math.max(1, Math.ceil(products.length / wishlistPageSize));
  const pagedProducts = products.slice((page - 1) * wishlistPageSize, page * wishlistPageSize);

  useEffect(() => {
    setPage(1);
  }, [slugs.length, user?.id]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

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
          <>
            <div className="product-grid">
              {pagedProducts.map((product) => (
                <WishlistProductCard
                  key={product.id}
                  product={product}
                  onRemove={() => toggle(product)}
                  onAdd={() => addItem(product)}
                />
              ))}
            </div>
            <div className="shop-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /> Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Next <ChevronRight size={17} /></button>
            </div>
          </>
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

function WishlistProductCard({
  product,
  onRemove,
  onAdd
}: {
  product: Product;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;

  return (
    <article className="product-card">
      <div className="card-topline">
        <span>{product.category?.name ?? "Pantry"}</span>
        <button type="button" onClick={onRemove} aria-label="Remove from wishlist">
          <Heart size={17} fill="currentColor" />
        </button>
      </div>
      <a href={`/products/${product.slug}`}><ProductArt product={product} /></a>
      <div className="product-meta">
        <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
        <div className="price-row">
          <strong>{formatMoney(price)}</strong>
          {compareAt && compareAt > price ? <small>{formatMoney(compareAt)}</small> : null}
        </div>
      </div>
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" onClick={onAdd}>
          <ShoppingBag size={17} />
          Add to bag
        </button>
      )}
    </article>
  );
}
