"use client";

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
  fallbackCatalog,
  formatMoney,
  searchCatalog,
  trackAnalyticsEvent
} from "../lib/catalog";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useWishlist } from "./WishlistContext";

export function ShopPage() {
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("featured");
  const [inStock, setInStock] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get("q") ?? "");
    setCategory(params.get("category") ?? "");
    setBrand(params.get("brand") ?? "");
  }, []);

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

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    if (search.trim()) {
      void trackAnalyticsEvent({
        type: "SEARCHED",
        query: search.trim(),
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, brands, or ingredients" />
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
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label>Brand
            <select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }}>
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
          <label className="shop-check"><input type="checkbox" checked={inStock} onChange={(event) => { setInStock(event.target.checked); setPage(1); }} /> In-stock products only</label>
          <button
            className="shop-clear"
            type="button"
            onClick={() => { setCategory(""); setBrand(""); setMinPrice(""); setMaxPrice(""); setInStock(false); setPage(1); }}
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
            <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort products">
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
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={17} /> Previous</button>
            <span>Page {result?.pagination.page ?? 1} of {result?.pagination.pages ?? 1}</span>
            <button type="button" disabled={page >= (result?.pagination.pages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight size={17} /></button>
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
  const saved = isSaved(product.slug);
  return (
    <article className="product-card">
      <div className="card-topline">
        <span>{product.badge || (product.isNew ? "New" : product.category?.name ?? "Pantry")}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? "Remove from wishlist" : "Save product"}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
      </div>
      <a className="product-image-link" href={`/products/${product.slug}`}><ProductArt product={product} /></a>
      <div className="product-meta">
        <span>{product.brand?.name ?? "My Ecom"}</span>
        <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
        {product.reviewCount ? <small>{product.rating} rating · {product.reviewCount} reviews</small> : null}
        <div className="price-row"><strong>{formatMoney(product.price)}</strong>{product.compareAt ? <small>{formatMoney(product.compareAt)}</small> : null}</div>
      </div>
      {product.variants?.length ? (
        <QuickVariantAdd product={product} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={() => addItem(product)}><ShoppingBag size={17} />{product.inventory ? "Add to bag" : "Out of stock"}</button>
      )}
    </article>
  );
}
