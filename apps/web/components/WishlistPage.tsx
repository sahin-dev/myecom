"use client";

import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { AppLocale, localeCode, localizedHref, localizeCatalog, localizeProduct } from "../lib/i18n";
import { AdvancePaymentBadge } from "./AdvancePaymentBadge";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useWishlist } from "./WishlistContext";

const wishlistPageSize = 12;

export function WishlistPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Wishlist");
  const common = useTranslations("Common");
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const { slugs, toggle } = useWishlist();
  const { addItem } = useCart();

  useEffect(() => {
    fetchCatalog().then((result) => setCatalog(localizeCatalog(result, locale))).catch(() => setCatalog(localizeCatalog(fallbackCatalog, locale)));
  }, [locale]);

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
    request.then((items) => setProducts(items.map((product) => localizeProduct(product, locale)))).catch(() => setProducts([]));
  }, [locale, slugs, user]);
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
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </section>
      <section className="wishlist-content">
        {products.length ? (
          <>
            <div className="product-grid">
              {pagedProducts.map((product) => (
                <WishlistProductCard
                  key={product.id}
                  product={product}
                  platformPolicy={catalog.siteSettings.checkoutPolicy}
                  onRemove={() => toggle(product)}
                  onAdd={() => addItem(product)}
                />
              ))}
            </div>
            <div className="shop-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /> {common("previous")}</button>
              <span>{common("page", { page, pages })}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}>{common("next")} <ChevronRight size={17} /></button>
            </div>
          </>
        ) : (
          <div className="wishlist-empty">
            <Heart size={40} strokeWidth={1.4} />
            <h2>{t("emptyTitle")}</h2>
            <p>{t("emptyDetail")}</p>
            <a className="primary-action" href={localizedHref("/shop", locale)}>{t("browse")}</a>
          </div>
        )}
      </section>
      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}

function WishlistProductCard({
  product,
  platformPolicy,
  onRemove,
  onAdd
}: {
  product: Product;
  platformPolicy?: Catalog["siteSettings"]["checkoutPolicy"];
  onRemove: () => void;
  onAdd: () => void;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Product");
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;

  return (
    <article className="product-card">
      <div className="card-topline">
        <span>{product.category?.name ?? t("pantry")}</span>
        <button type="button" onClick={onRemove} aria-label={t("removeWishlist")}>
          <Heart size={17} fill="currentColor" />
        </button>
      </div>
      <a href={localizedHref(`/products/${product.slug}`, locale)}><ProductArt product={product} /></a>
      <div className="product-meta">
        <h3><a href={localizedHref(`/products/${product.slug}`, locale)}>{product.name}</a></h3>
        <div className="price-row">
          <strong>{formatMoney(price, localeCode(locale))}</strong>
          {compareAt && compareAt > price ? <small>{formatMoney(compareAt, localeCode(locale))}</small> : null}
        </div>
      </div>
      <AdvancePaymentBadge product={product} policy={platformPolicy} />
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" onClick={onAdd}>
          <ShoppingBag size={17} />
          {t("addToBag")}
        </button>
      )}
    </article>
  );
}
