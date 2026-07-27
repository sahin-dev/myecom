"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal
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
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
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

export function ShopPage({ initialQuery = emptyQuery }: { initialQuery?: ShopQuery }) {
  const router = useRouter();
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
      limit: 16
    })
      .then(setResult)
      .finally(() => setLoading(false));
  }, [brand, category, inStock, maxPrice, minPrice, page, search, sort]);

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
    router.push(query ? `/shop?${query}` : "/shop");
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

  return (
    <main>
      <PageHeader categories={categories} />
      <section className="shop-page-head">
        <div>
          <p className="eyebrow">Full catalog</p>
          <h1>Find the right pantry essential</h1>
          <p>Search, compare, and filter every available product.</p>
        </div>
        <form onSubmit={submitSearch}>
          <Search size={18} />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search products, brands, or ingredients" />
          <button type="submit">Search</button>
        </form>
      </section>

      <section className="shop-workspace">
        <aside className={filtersOpen ? "open" : ""}>
          <div className="shop-filter-title">
            <strong><SlidersHorizontal size={17} /> Filters</strong>
            <button type="button" onClick={() => setFiltersOpen(false)}>Close</button>
          </div>
          <label>Category
            <select value={category} onChange={(event) => navigate({ category: event.target.value, page: 1 })}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label>Brand
            <select value={brand} onChange={(event) => navigate({ brand: event.target.value, page: 1 })}>
              <option value="">All brands</option>
              {result?.facets.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Price range</legend>
            <div>
              <input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min" />
              <input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max" />
            </div>
          </fieldset>
          <label className="shop-check"><input type="checkbox" checked={inStock} onChange={(event) => navigate({ inStock: event.target.checked, page: 1 })} /> In-stock products only</label>
          <button className="shop-apply" type="button" onClick={() => navigate({ minPrice, maxPrice, page: 1 })}>
            Apply price range
          </button>
          <button
            className="shop-clear"
            type="button"
            onClick={() => router.push("/shop")}
          >
            Clear filters
          </button>
        </aside>

        <div className="shop-results">
          <div className="shop-results-bar">
            <div>
              <button type="button" onClick={() => setFiltersOpen(true)}><Filter size={16} /> Filters</button>
              <span>{result?.pagination.total ?? 0} products</span>
            </div>
            <select value={sort} onChange={(event) => navigate({ sort: event.target.value, page: 1 })} aria-label="Sort products">
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>

          {loading ? <div className="shop-loading">Updating products...</div> : null}
          {!loading && result?.products.length ? (
            <div className="product-grid shop-product-grid">
              {result.products.map((product) => <ShopProduct key={product.id} product={product} />)}
            </div>
          ) : null}
          {!loading && !result?.products.length ? (
            <div className="search-empty"><Search size={30} /><h2>No products found</h2><p>Try widening the price range or clearing a filter.</p></div>
          ) : null}

          <div className="shop-pagination">
            <button type="button" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}><ChevronLeft size={17} /> Previous</button>
            <span>Page {result?.pagination.page ?? 1} of {result?.pagination.pages ?? 1}</span>
            <button type="button" disabled={page >= (result?.pagination.pages ?? 1)} onClick={() => navigate({ page: page + 1 })}>Next <ChevronRight size={17} /></button>
          </div>
        </div>
      </section>
      <PageFooter categories={categories} />
    </main>
  );
}

function ShopProduct({ product }: { product: Product }) {
  const { addItem } = useCart();
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
        <span>{product.badge || (product.isNew ? "New" : product.category?.name ?? "Pantry")}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? "Remove from wishlist" : "Save product"}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
      </div>
      <Link className="product-image-link" href={`/products/${product.slug}`}><ProductArt product={product} /></Link>
      <div className="product-meta">
        <span>{product.brand?.name ?? "My Ecom"}</span>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        {product.reviewCount ? <small>{product.rating} rating · {product.reviewCount} reviews</small> : null}
        <div className="price-row"><strong>{formatMoney(displayPrice)}</strong>{displayCompareAt ? <small>{formatMoney(displayCompareAt)}</small> : null}{savings ? <em>Save {savings}%</em> : null}</div>
        <div className="product-card-facts">
          <span className={availableInventory <= 5 ? "low-stock" : ""}>{availableInventory > 5 ? "In stock" : availableInventory > 0 ? `Only ${availableInventory} left` : "Out of stock"}</span>
          <span>1-2 day delivery</span>
        </div>
      </div>
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={() => addItem(product)}><ShoppingBag size={17} />{product.inventory ? "Add to bag" : "Out of stock"}</button>
      )}
    </article>
  );
}
