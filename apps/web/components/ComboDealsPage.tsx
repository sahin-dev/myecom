"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Gift, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Catalog,
  Product,
  ProductVariant,
  fallbackCatalog,
  fallbackComboDeals,
  fetchCatalog,
  fetchComboDeals,
  formatMoney
} from "../lib/catalog";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd, SimpleAddToCartButton } from "./QuickVariantAdd";

const comboDealsPageSize = 8;

export function ComboDealsPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [combos, setCombos] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCatalog().catch(() => fallbackCatalog),
      fetchComboDeals().catch(() => fallbackComboDeals)
    ])
      .then(([nextCatalog, nextCombos]) => {
        setCatalog(nextCatalog);
        setCombos(nextCombos);
      })
      .finally(() => setLoading(false));
  }, []);
  const pages = Math.max(1, Math.ceil(combos.length / comboDealsPageSize));
  const pagedCombos = combos.slice((page - 1) * comboDealsPageSize, page * comboDealsPageSize);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  return (
    <main className="combo-deals-page">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} />
      <section className="combo-deals-heading">
        <div>
          <p className="eyebrow">Bundle and save</p>
          <h1>Combo deals</h1>
          <p>Practical product combinations with one clear bundle price.</p>
        </div>
        <a href="/shop">Browse individual products <ArrowRight size={16} /></a>
      </section>

      <section className="combo-deals-content" aria-live="polite">
        {loading ? <div className="shop-loading">Loading combo deals...</div> : null}
        {!loading && combos.length ? (
          <>
            <div className="combo-deals-grid">
              {pagedCombos.map((combo) => <ComboDealCard combo={combo} key={combo.id} />)}
            </div>
            <div className="shop-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /> Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Next <ChevronRight size={17} /></button>
            </div>
          </>
        ) : null}
        {!loading && !combos.length ? (
          <div className="combo-deals-empty">
            <Gift size={40} strokeWidth={1.4} />
            <h2>New bundles are being prepared</h2>
            <p>Explore the full catalog while the next combo deals are assembled.</p>
            <a className="primary-action" href="/shop">Browse products</a>
          </div>
        ) : null}
      </section>
      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}

function ComboDealCard({ combo }: { combo: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const price = selectedVariant?.price ?? combo.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : combo.compareAt;
  const saving =
    compareAt && compareAt > price
      ? Math.round(((compareAt - price) / compareAt) * 100)
      : 0;

  return (
    <article className="combo-deal-card">
      <a className="combo-deal-art" href={`/products/${combo.slug}`}>
        <ProductArt product={combo} />
        {saving ? <span>Save {saving}%</span> : null}
      </a>
      <div className="combo-deal-copy">
        <small>{combo.badge ?? "Combo deal"}</small>
        <h2><a href={`/products/${combo.slug}`}>{combo.name}</a></h2>
        <p>{combo.description}</p>
        {combo.comboProducts?.length ? (
          <div className="combo-includes">
            <strong><PackageCheck size={15} /> This combo includes</strong>
            <ul>
              {combo.comboProducts.map((product) => (
                <li key={product.id}>{product.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="price-row">
          <strong>{formatMoney(price)}</strong>
          {compareAt && compareAt > price ? <small>{formatMoney(compareAt)}</small> : null}
        </div>
        <a className="combo-detail-link" href={`/products/${combo.slug}`}>
          View details <ArrowRight size={15} />
        </a>
      </div>
      {combo.variants?.length ? (
        <QuickVariantAdd product={combo} onSelect={setSelectedVariant} />
      ) : (
        <SimpleAddToCartButton product={combo} label="Add combo to bag" outOfStockLabel="Out of stock" />
      )}
    </article>
  );
}
