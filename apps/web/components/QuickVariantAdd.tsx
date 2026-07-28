"use client";

import { Check, ChevronDown, ShoppingBag, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Product,
  ProductVariant,
  baseProductOptionLabel,
  formatMoney,
  isBaseProductEnabled
} from "../lib/catalog";
import { useCart } from "./CartContext";

const baseSelection = "base";
type VariantSelection = ProductVariant | typeof baseSelection;

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
  const [selected, setSelected] = useState<VariantSelection | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleId = useId();
  const { addItem } = useCart();
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  const baseEnabled = isBaseProductEnabled(product);
  const baseAvailable = baseEnabled && product.inventory > 0;
  const available = baseAvailable || variants.some((variant) => variant.inventory > 0);
  const selectedVariant = selected === baseSelection ? null : selected;
  const selectedLabel =
    selected === baseSelection ? baseProductOptionLabel(product) : selected?.name;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const focusFrame = window.requestAnimationFrame(() => {
      const selectedOption = dialogRef.current?.querySelector<HTMLButtonElement>(
        ".quick-option-choice.active:not(:disabled)"
      );
      const firstOption = dialogRef.current?.querySelector<HTMLButtonElement>(
        ".quick-option-choice:not(:disabled)"
      );
      (selectedOption ?? firstOption)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const selectOption = (selection: VariantSelection) => {
    setSelected(selection);
    onSelect?.(selection === baseSelection ? null : selection);
  };

  const addSelected = () => {
    if (selected === null) return;
    addItem(product, 1, selected === baseSelection ? null : selected);
    setOpen(false);
  };

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

  const optionSheet = open ? (
    <div
      className="quick-option-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        className="quick-option-sheet"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <header className="quick-option-head">
          <div>
            <small>{product.name}</small>
            <h2 id={dialogTitleId}>Choose an option</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close option chooser">
            <X size={18} />
          </button>
        </header>
        <div className="quick-option-list" role="radiogroup" aria-label="Available product options">
          {baseEnabled ? (
            <button
              type="button"
              className={`quick-option-choice ${selected === baseSelection ? "active" : ""}`}
              role="radio"
              aria-checked={selected === baseSelection}
              disabled={product.inventory < 1}
              onClick={() => selectOption(baseSelection)}
            >
              <span className="quick-option-indicator">
                {selected === baseSelection ? <Check size={14} /> : null}
              </span>
              <span className="quick-option-copy">
                <strong>{baseProductOptionLabel(product)}</strong>
                <small>{product.inventory > 0 ? `${product.inventory} available` : "Out of stock"}</small>
              </span>
              <b>{formatMoney(product.price)}</b>
            </button>
          ) : null}
          {variants.map((variant) => {
            const isSelected = selected !== baseSelection && selected?.id === variant.id;

            return (
              <button
                type="button"
                key={variant.id}
                className={`quick-option-choice ${isSelected ? "active" : ""}`}
                role="radio"
                aria-checked={isSelected}
                disabled={variant.inventory < 1}
                onClick={() => selectOption(variant)}
              >
                <span className="quick-option-indicator">
                  {isSelected ? <Check size={14} /> : null}
                </span>
                <span className="quick-option-copy">
                  <strong>{variant.name}</strong>
                  <small>{variant.inventory > 0 ? `${variant.inventory} available` : "Out of stock"}</small>
                </span>
                <b>{formatMoney(variant.price)}</b>
              </button>
            );
          })}
        </div>
        <footer className="quick-option-actions">
          <button
            className="add-button full"
            type="button"
            disabled={selected === null}
            onClick={addSelected}
          >
            <ShoppingBag size={16} />
            {selected === null ? "Select an option" : "Add to bag"}
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`quick-variant-picker ${selected !== null ? "has-selection" : ""}`}>
        <button
          ref={triggerRef}
          className={`${className} quick-variant-trigger`}
          type="button"
          disabled={!available}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
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
      </div>
      {optionSheet ? createPortal(optionSheet, document.body) : null}
    </>
  );
}
