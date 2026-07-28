"use client";

import { Check, ChevronDown, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import {
  Product,
  ProductVariant,
  baseProductOptionLabel,
  formatMoney,
  isBaseProductEnabled
} from "../lib/catalog";
import { useCart } from "./CartContext";

const baseSelection = "base";

export function QuickVariantAdd({
  product,
  className = "add-button full",
  onSelect
}: {
  product: Product;
  className?: string;
  onSelect?: (variant: ProductVariant | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductVariant | typeof baseSelection | null>(null);
  const { addItem } = useCart();
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  const baseEnabled = isBaseProductEnabled(product);
  const baseAvailable = baseEnabled && product.inventory > 0;
  const available = baseAvailable || variants.some((variant) => variant.inventory > 0);
  const selectedVariant = selected === baseSelection ? null : selected;
  const selectedLabel =
    selected === baseSelection ? baseProductOptionLabel(product) : selected?.name;

  if (!variants.length) {
    return (
      <button
        className={className}
        type="button"
        disabled={product.inventory < 1}
        onClick={() => addItem(product)}
      >
        <ShoppingBag size={16} />
        {product.inventory > 0 ? "Add to bag" : "Out of stock"}
      </button>
    );
  }

  return (
    <div className={`quick-variant-picker ${selected !== null ? "has-selection" : ""}`}>
      <button
        className={`${className} quick-variant-trigger`}
        type="button"
        disabled={!available}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <ShoppingBag size={16} />
        <span>{available ? selectedLabel ?? "Choose option" : "Out of stock"}</span>
        {available ? <ChevronDown size={15} /> : null}
      </button>
      {selected !== null ? (
        <button
          className="add-button quick-variant-confirm"
          type="button"
          disabled={selectedVariant ? selectedVariant.inventory < 1 : product.inventory < 1}
          onClick={() => addItem(product, 1, selectedVariant)}
        >
          <ShoppingBag size={16} />
          Add
        </button>
      ) : null}
      {open ? (
        <div className="quick-variant-menu" role="dialog" aria-label={`Choose an option for ${product.name}`}>
          <header>
            <strong>Choose an option</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close option chooser">
              <X size={15} />
            </button>
          </header>
          <div>
            {baseEnabled ? (
              <button
                type="button"
                className={selected === baseSelection ? "active" : ""}
                disabled={product.inventory < 1}
                onClick={() => {
                  setSelected(baseSelection);
                  onSelect?.(null);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{baseProductOptionLabel(product)}</strong>
                  <small>{product.inventory > 0 ? `${product.inventory} available` : "Out of stock"}</small>
                </span>
                <b>{formatMoney(product.price)}</b>
                {selected === baseSelection ? <Check size={15} /> : null}
              </button>
            ) : null}
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                className={selected !== baseSelection && selected?.id === variant.id ? "active" : ""}
                disabled={variant.inventory < 1}
                onClick={() => {
                  setSelected(variant);
                  onSelect?.(variant);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{variant.name}</strong>
                  <small>{variant.inventory > 0 ? `${variant.inventory} available` : "Out of stock"}</small>
                </span>
                <b>{formatMoney(variant.price)}</b>
                {selected !== baseSelection && selected?.id === variant.id ? <Check size={15} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
