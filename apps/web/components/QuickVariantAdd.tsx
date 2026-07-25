"use client";

import { ChevronDown, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { Product, formatMoney } from "../lib/catalog";
import { useCart } from "./CartContext";

export function QuickVariantAdd({
  product,
  className = "add-button full"
}: {
  product: Product;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { addItem } = useCart();
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  const available = variants.some((variant) => variant.inventory > 0);

  return (
    <div className="quick-variant-picker">
      <button
        className={`${className} quick-variant-trigger`}
        type="button"
        disabled={!available}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <ShoppingBag size={16} />
        {available ? "Choose option" : "Out of stock"}
        {available ? <ChevronDown size={15} /> : null}
      </button>
      {open ? (
        <div className="quick-variant-menu" role="dialog" aria-label={`Choose an option for ${product.name}`}>
          <header>
            <strong>Choose an option</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close option chooser">
              <X size={15} />
            </button>
          </header>
          <div>
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                disabled={variant.inventory < 1}
                onClick={() => {
                  addItem(product, 1, variant);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{variant.name}</strong>
                  <small>{variant.inventory > 0 ? `${variant.inventory} available` : "Out of stock"}</small>
                </span>
                <b>{formatMoney(variant.price)}</b>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
