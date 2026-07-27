"use client";

import { ArrowRight, Gift, PackageCheck, ShoppingBag } from "lucide-react";
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
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";

export function ComboDealsPage() {
  const [catalog, setCatalog] = useState<Catalog>(fallbackCatalog);
  const [combos, setCombos] = useState<Product[]>([]);
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
          <div className="combo-deals-grid">
            {combos.map((combo) => <ComboDealCard combo={combo} key={combo.id} />)}
          </div>
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
  const { addItem } = useCart();
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
        <button
          className="add-button full"
          type="button"
          disabled={combo.inventory < 1}
          onClick={() => addItem(combo)}
        >
          <ShoppingBag size={17} />
          {combo.inventory > 0 ? "Add combo to bag" : "Out of stock"}
        </button>
      )}
    </article>
  );
}
