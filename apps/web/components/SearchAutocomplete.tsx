"use client";

import { Search, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  Category,
  Product,
  formatMoney,
  resolveMediaUrl,
  searchCatalog
} from "../lib/catalog";

const recentSearchKey = "my-ecom-recent-searches";

function productImage(product: Product) {
  return resolveMediaUrl(
    product.imageUrl ??
    product.images?.slice().sort((a, b) => a.position - b.position)[0]?.url
  );
}

export function SearchAutocomplete({
  categories,
  placeholder = "Search products, brands, or ingredients"
}: {
  categories: Category[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(window.localStorage.getItem(recentSearchKey) ?? "[]") as string[]);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchCatalog({ search: trimmed, limit: 6 })
        .then((result) => setProducts(result.products))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 240);
    return () => window.clearTimeout(timer);
  }, [query]);

  const matchingCategories = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    return categories
      .filter((category) => category.name.toLowerCase().includes(trimmed))
      .slice(0, 4);
  }, [categories, query]);

  function remember(value: string) {
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 5);
    setRecent(next);
    window.localStorage.setItem(recentSearchKey, JSON.stringify(next));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    remember(trimmed);
    window.location.assign(`/shop?q=${encodeURIComponent(trimmed)}`);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!products.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % products.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + products.length) % products.length);
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      window.location.assign(`/products/${products[activeIndex].slug}`);
    }
    if (event.key === "Escape") setOpen(false);
  }

  const showRecent = open && !query.trim() && recent.length;
  const showResults = open && query.trim().length >= 2;

  return (
    <form className="search-shell predictive-search" action="/shop" method="get" onSubmit={submit}>
      <Search size={19} />
      <input
        name="q"
        value={query}
        placeholder={placeholder}
        role="combobox"
        autoComplete="off"
        aria-expanded={Boolean(showRecent || showResults)}
        aria-controls="site-search-suggestions"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={keyDown}
      />
      {query ? (
        <button type="button" onClick={() => { setQuery(""); setProducts([]); }} aria-label="Clear search">
          <X size={15} />
        </button>
      ) : null}
      {showRecent || showResults ? (
        <div className="search-suggestions" id="site-search-suggestions">
          {showRecent ? (
            <section>
              <header><strong>Recent searches</strong></header>
              {recent.map((item) => (
                <a href={`/shop?q=${encodeURIComponent(item)}`} key={item} onMouseDown={() => remember(item)}>
                  <Search size={14} /> {item}
                </a>
              ))}
            </section>
          ) : null}
          {showResults ? (
            <>
              {matchingCategories.length ? (
                <section>
                  <header><strong>Categories</strong></header>
                  <div className="search-category-results">
                    {matchingCategories.map((category) => (
                      <a href={`/shop?category=${category.slug}`} key={category.id}>
                        {category.name}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
              <section>
                <header>
                  <strong>Products</strong>
                  {loading ? <span>Searching...</span> : null}
                </header>
                {!loading && !products.length ? <p>No matching products found.</p> : null}
                {products.map((product, index) => {
                  const image = productImage(product);
                  return (
                    <a
                      className={index === activeIndex ? "active" : ""}
                      href={`/products/${product.slug}`}
                      key={product.id}
                    >
                      <span className="search-result-image">
                        {image ? <img src={image} alt="" /> : <Search size={15} />}
                      </span>
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.category?.name ?? "Product"}</small>
                      </span>
                      <b>{formatMoney(product.price)}</b>
                    </a>
                  );
                })}
                <a className="search-view-all" href={`/shop?q=${encodeURIComponent(query.trim())}`}>
                  View all search results
                </a>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
