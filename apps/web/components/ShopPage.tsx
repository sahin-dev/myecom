"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  CatalogSearchResult,
  Product,
  ProductVariant,
  fallbackCatalog,
  formatMoney,
  selectableProductInventory,
  searchCatalog,
  trackAnalyticsEvent
} from "../lib/catalog";
import { AppLocale, localeCode, localizedHref, localizeSearchResult } from "../lib/i18n";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { ProductVideo } from "./ProductVideo";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { AdvancePaymentBadge } from "./AdvancePaymentBadge";
import { RatingStars } from "./RatingStars";
import { useSiteSettings } from "./SiteSettingsContext";
import { useWishlist } from "./WishlistContext";

type ShopQuery = {
  search: string;
  category: string;
  brand: string;
  sort: string;
  inStock: boolean;
  minPrice: string;
  maxPrice: string;
  page: number;
};

const emptyQuery: ShopQuery = {
  search: "",
  category: "",
  brand: "",
  sort: "featured",
  inStock: false,
  minPrice: "",
  maxPrice: "",
  page: 1
};
const shopPageSize = 48;

export function ShopPage({ initialQuery = emptyQuery }: { initialQuery?: ShopQuery }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Shop");
  const common = useTranslations("Common");
  const searchText = useTranslations("Search");
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [search, setSearch] = useState(initialQuery.search);
  const [searchDraft, setSearchDraft] = useState(initialQuery.search);
  const [category, setCategory] = useState(initialQuery.category);
  const [brand, setBrand] = useState(initialQuery.brand);
  const [sort, setSort] = useState(initialQuery.sort);
  const [inStock, setInStock] = useState(initialQuery.inStock);
  const [minPrice, setMinPrice] = useState(initialQuery.minPrice);
  const [maxPrice, setMaxPrice] = useState(initialQuery.maxPrice);
  const [page, setPage] = useState(initialQuery.page);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setSearch(initialQuery.search);
    setSearchDraft(initialQuery.search);
    setCategory(initialQuery.category);
    setBrand(initialQuery.brand);
    setSort(initialQuery.sort);
    setInStock(initialQuery.inStock);
    setMinPrice(initialQuery.minPrice);
    setMaxPrice(initialQuery.maxPrice);
    setPage(initialQuery.page);
  }, [initialQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchCatalog({
      search,
      category,
      brand,
      sort,
      inStock,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      page,
      limit: shopPageSize
    })
      .then((nextResult) => {
        if (!active) return;
        setResult(localizeSearchResult(nextResult, locale));
        if (page > nextResult.pagination.pages) navigate({ page: nextResult.pagination.pages });
      })
      .catch(() => {
        if (active) setResult(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [brand, category, inStock, locale, maxPrice, minPrice, page, search, sort]);

  function navigate(overrides: Partial<ShopQuery>) {
    const next = {
      search,
      category,
      brand,
      sort,
      inStock,
      minPrice,
      maxPrice,
      page,
      ...overrides
    };
    setSearch(next.search);
    setSearchDraft(next.search);
    setCategory(next.category);
    setBrand(next.brand);
    setSort(next.sort);
    setInStock(next.inStock);
    setMinPrice(next.minPrice);
    setMaxPrice(next.maxPrice);
    setPage(Math.max(1, next.page));
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    if (next.category) params.set("category", next.category);
    if (next.brand) params.set("brand", next.brand);
    if (next.sort !== "featured") params.set("sort", next.sort);
    if (next.inStock) params.set("inStock", "true");
    if (next.minPrice) params.set("minPrice", next.minPrice);
    if (next.maxPrice) params.set("maxPrice", next.maxPrice);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    router.push(localizedHref(query ? `/shop?${query}` : "/shop", locale));
  }

  function clearFilters() {
    navigate({ ...emptyQuery });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const nextSearch = searchDraft.trim();
    setSearch(nextSearch);
    setPage(1);
    navigate({ search: nextSearch, page: 1 });
    if (nextSearch) {
      void trackAnalyticsEvent({
        type: "SEARCHED",
        query: nextSearch,
        metadata: { category, brand }
      });
    }
  }

  const categories = result?.facets.categories ?? fallbackCatalog.categories;
  const pagination = result?.pagination;
  const totalProducts = pagination?.total ?? 0;
  const showingStart = totalProducts ? ((pagination?.page ?? page) - 1) * (pagination?.limit ?? shopPageSize) + 1 : 0;
  const showingEnd = pagination ? Math.min(totalProducts, pagination.page * pagination.limit) : 0;

  return (
    <main>
      <PageHeader categories={categories} />
      <section className="shop-page-head">
        <div>
          <p className="eyebrow">{t("fullCatalog")}</p>
          <h1>{t("pageTitle")}</h1>
          <p>{t("pageSubtitle")}</p>
        </div>
        <form onSubmit={submitSearch}>
          <Search size={18} />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={searchText("placeholder")} />
          <button type="submit">{common("search")}</button>
        </form>
      </section>

      <section className="shop-workspace">
        {filtersOpen ? (
          <button
            className="shop-filter-backdrop"
            type="button"
            onClick={() => setFiltersOpen(false)}
            aria-label={t("closeFilters")}
          />
        ) : null}
        <aside className={filtersOpen ? "open" : ""}>
          <div className="shop-filter-title">
            <strong><SlidersHorizontal size={17} /> {t("filters")}</strong>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label={t("closeFilters")}>
              <X size={15} />
            </button>
          </div>
          <label>{t("category")}
            <select value={category} onChange={(event) => navigate({ category: event.target.value, page: 1 })}>
              <option value="">{t("allCategories")}</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label>{t("brand")}
            <select value={brand} onChange={(event) => navigate({ brand: event.target.value, page: 1 })}>
              <option value="">{t("allBrands")}</option>
              {result?.facets.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>{t("priceRange")}</legend>
            <div>
              <input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={t("minimum")} />
              <input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={t("maximum")} />
            </div>
          </fieldset>
          <label className="shop-check"><input type="checkbox" checked={inStock} onChange={(event) => navigate({ inStock: event.target.checked, page: 1 })} /> {t("inStockOnly")}</label>
          <button className="shop-apply" type="button" onClick={() => navigate({ minPrice, maxPrice, page: 1 })}>
            {t("applyPrice")}
          </button>
          <button
            className="shop-clear"
            type="button"
            onClick={clearFilters}
          >
            {t("clearFilters")}
          </button>
        </aside>

        <div className="shop-results">
          <div className="shop-results-bar">
            <div>
              <button type="button" onClick={() => setFiltersOpen(true)}><Filter size={16} /> {t("filters")}</button>
              <span>
                {totalProducts
                  ? t("showing", { start: showingStart, end: showingEnd, total: totalProducts })
                  : t("zeroProducts")}
              </span>
            </div>
            <select value={sort} onChange={(event) => navigate({ sort: event.target.value, page: 1 })} aria-label={t("sort")}>
              <option value="featured">{t("featured")}</option>
              <option value="newest">{t("newest")}</option>
              <option value="price-asc">{t("priceLow")}</option>
              <option value="price-desc">{t("priceHigh")}</option>
            </select>
          </div>

          {loading ? <div className="shop-loading">{t("updating")}</div> : null}
          {!loading && result?.products.length ? (
            <div className="product-grid shop-product-grid">
              {result.products.map((product) => <ShopProduct key={product.id} product={product} />)}
            </div>
          ) : null}
          {!loading && !result?.products.length ? (
            <div className="search-empty"><Search size={30} /><h2>{t("notFoundTitle")}</h2><p>{t("notFoundDetail")}</p></div>
          ) : null}

          <div className="shop-pagination">
            <button type="button" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}><ChevronLeft size={17} /> {common("previous")}</button>
            <span>{common("page", { page: result?.pagination.page ?? 1, pages: result?.pagination.pages ?? 1 })}</span>
            <button type="button" disabled={page >= (result?.pagination.pages ?? 1)} onClick={() => navigate({ page: page + 1 })}>{common("next")} <ChevronRight size={17} /></button>
          </div>
        </div>
      </section>
      <PageFooter categories={categories} />
    </main>
  );
}

function ShopProduct({ product }: { product: Product }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Product");
  const common = useTranslations("Common");
  const { addItem } = useCart();
  const { settings } = useSiteSettings();
  const { isSaved, toggle } = useWishlist();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const saved = isSaved(product.slug);
  const availableInventory = selectedVariant
    ? selectedVariant.inventory
    : selectableProductInventory(product);
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayCompareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;
  const savings = displayCompareAt && displayCompareAt > displayPrice
    ? Math.round(((displayCompareAt - displayPrice) / displayCompareAt) * 100)
    : 0;
  return (
    <article className="product-card">
      <div className="card-topline">
        <span>{product.badge || (product.isNew ? t("new") : product.category?.name ?? t("pantry"))}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? t("removeWishlist") : t("saveProduct")}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
      </div>
      <Link className="product-image-link" href={localizedHref(`/products/${product.slug}`, locale)}>
        <ProductVideo src={product.videoUrl} poster={product.imageUrl} label={t("playPromo")}>
          <ProductArt product={product} />
        </ProductVideo>
      </Link>
      <div className="product-meta">
        <span className="product-brand">{product.brand?.name ?? "My Ecom"}</span>
        <h3><Link href={localizedHref(`/products/${product.slug}`, locale)}>{product.name}</Link></h3>
        {product.reviewCount ? (
          <RatingStars
            rating={product.rating}
            count={product.reviewCount}
            countLabel={t("reviewCount", { count: product.reviewCount })}
            label={t("ratingReviews", { rating: product.rating ?? 0, count: product.reviewCount })}
          />
        ) : null}
        <div className="price-row"><strong>{formatMoney(displayPrice, localeCode(locale))}</strong>{displayCompareAt ? <small>{formatMoney(displayCompareAt, localeCode(locale))}</small> : null}{savings ? <em>Save {savings}%</em> : null}</div>
        <div className="product-card-facts">
          <span className={availableInventory <= 5 ? "low-stock" : ""}>{availableInventory > 5 ? common("inStock") : availableInventory > 0 ? t("onlyLeft", { count: availableInventory }) : common("outOfStock")}</span>
          <span>{t("deliveryTime")}</span>
        </div>
      </div>
      <AdvancePaymentBadge product={product} policy={settings.checkoutPolicy} />
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={() => addItem(product)}><ShoppingBag size={17} />{product.inventory ? t("addToBag") : common("outOfStock")}</button>
      )}
    </article>
  );
}
