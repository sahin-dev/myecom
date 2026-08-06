"use client";

import { Check, ChevronDown, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Product,
  ProductVariant,
  baseProductOptionLabel,
  formatMoney,
  isBaseProductEnabled,
  productAdvancePaymentLabel
} from "../lib/catalog";
import { useCart } from "./CartContext";
import { ProductArt } from "./ProductArt";
import { useSiteSettings } from "./SiteSettingsContext";

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
  const [quantity, setQuantity] = useState(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleId = useId();
  const { addItem } = useCart();
  const { settings } = useSiteSettings();
  const variants = (product.variants ?? []).filter((variant) => variant.isActive);
  const baseEnabled = isBaseProductEnabled(product);
  const baseAvailable = baseEnabled && product.inventory > 0;
  const available = baseAvailable || variants.some((variant) => variant.inventory > 0);
  const selectedVariant = selected === baseSelection ? null : selected;
  const selectedLabel =
    selected === baseSelection ? baseProductOptionLabel(product) : selected?.name;
  const selectedPrice = selectedVariant?.price ?? product.price;
  const selectedCompareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;
  const selectedInventory =
    selected === null
      ? baseAvailable
        ? product.inventory
        : variants.find((variant) => variant.inventory > 0)?.inventory ?? 0
      : selectedVariant?.inventory ?? product.inventory;
  const subtotal = selectedPrice * quantity;
  const savings =
    selectedCompareAt && selectedCompareAt > selectedPrice
      ? (selectedCompareAt - selectedPrice) * quantity
      : 0;
  const advanceLabel = productAdvancePaymentLabel(product, settings.checkoutPolicy);

  useEffect(() => {
    if (!open) return;
    if (selected === null) {
      const firstAvailable = baseAvailable
        ? baseSelection
        : variants.find((variant) => variant.inventory > 0) ?? null;
      if (firstAvailable) selectOption(firstAvailable);
    }

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
  }, [baseAvailable, open, selected, variants]);

  const selectOption = (selection: VariantSelection) => {
    setSelected(selection);
    setQuantity(1);
    onSelect?.(selection === baseSelection ? null : selection);
  };

  const changeQuantity = (delta: number) => {
    setQuantity((current) => Math.min(Math.max(current + delta, 1), Math.max(selectedInventory, 1)));
  };

  const addSelected = () => {
    if (selected === null) return;
    addItem(product, quantity, selected === baseSelection ? null : selected);
    setOpen(false);
  };

  if (!variants.length) {
    return <SimpleAddToCartButton product={product} className={className} label="Add to bag" outOfStockLabel="Out of stock" />;
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
        <div className="quick-option-art">
          <ProductArt product={product} />
        </div>
        <div className="quick-option-panel">
          <header className="quick-option-head">
            <div>
              <small>{product.brand?.name ?? product.category?.name ?? "Product option"}</small>
              <h2 id={dialogTitleId}>{product.name}</h2>
              {advanceLabel ? <p className="quick-option-advance">{advanceLabel}</p> : null}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close option chooser">
              <X size={18} />
            </button>
          </header>
          <div className="quick-option-price">
            <strong>{formatMoney(selectedPrice)}</strong>
            {selectedCompareAt && selectedCompareAt > selectedPrice ? (
              <>
                <small>{formatMoney(selectedCompareAt)}</small>
                <em>Save {Math.round(((selectedCompareAt - selectedPrice) / selectedCompareAt) * 100)}%</em>
              </>
            ) : null}
          </div>
          <div className="quick-option-meta">
            <span>{selectedLabel ?? "Choose an option"}</span>
            <span>{selectedInventory > 0 ? `${selectedInventory} available` : "Out of stock"}</span>
          </div>
          <section className="quick-option-section">
            <span>Select option</span>
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
                {selected === baseSelection ? <Check size={13} /> : null}
                <strong>{baseProductOptionLabel(product)}</strong>
                <small>{formatMoney(product.price)}</small>
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
                    {isSelected ? <Check size={13} /> : null}
                    <strong>{variant.name}</strong>
                    <small>{formatMoney(variant.price)}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="quick-option-purchase">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
              {savings > 0 ? <small>Save {formatMoney(savings)}</small> : null}
            </div>
            <div>
              <span>Quantity</span>
              <div className="quick-option-stepper">
                <button type="button" onClick={() => changeQuantity(-1)} disabled={quantity <= 1} aria-label="Decrease quantity">
                  <Minus size={15} />
                </button>
                <strong>{quantity}</strong>
                <button type="button" onClick={() => changeQuantity(1)} disabled={quantity >= selectedInventory} aria-label="Increase quantity">
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </section>
          <footer className="quick-option-actions">
            <button
              className="add-button full"
              type="button"
              disabled={selected === null || selectedInventory < 1}
              onClick={addSelected}
            >
              <ShoppingBag size={17} />
              {selected === null ? "Select an option" : selectedInventory < 1 ? "Out of stock" : "Add to cart"}
            </button>
          </footer>
        </div>
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
      </div>
      {optionSheet ? createPortal(optionSheet, document.body) : null}
    </>
  );
}

/**
 * The "Add to bag" button for a product with no variants to choose between.
 * Once the product is in the cart, it morphs in place into a +/- stepper for
 * that line, so raising or lowering the quantity — or clearing it entirely at
 * zero, via CartContext's own filtering — never requires opening the cart.
 *
 * Reused across every product-card surface (shop grid, storefront rails,
 * combos, wishlist, account) rather than duplicated per page, so this
 * behaviour is one implementation, not five kept in sync by hand.
 */
export function SimpleAddToCartButton({
  product,
  className = "add-button full",
  label,
  outOfStockLabel,
  checkStock = true
}: {
  product: Product;
  className?: string;
  label: ReactNode;
  outOfStockLabel?: ReactNode;
  /** Some callers (e.g. the wishlist) never disable the button on stock. */
  checkStock?: boolean;
}) {
  const { cart, addItem, updateQuantity } = useCart();
  const line = cart.find((item) => !item.variant && item.product.id === product.id);
  const quantity = line?.quantity ?? 0;
  const outOfStock = checkStock && product.inventory < 1;
  const ariaLabel = typeof label === "string" ? label : product.name;

  if (quantity > 0) {
    return (
      <div className={`${className} add-button-stepper`.trim()} role="group" aria-label={ariaLabel}>
        <button
          type="button"
          onClick={() => updateQuantity(product.id, quantity - 1)}
          aria-label="Decrease quantity"
        >
          <Minus size={16} />
        </button>
        <strong>{quantity}</strong>
        <button
          type="button"
          onClick={() => updateQuantity(product.id, quantity + 1)}
          disabled={checkStock && quantity >= product.inventory}
          aria-label="Increase quantity"
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <button className={className} type="button" disabled={outOfStock} onClick={() => addItem(product)}>
      <ShoppingBag size={16} />
      {outOfStock && outOfStockLabel ? outOfStockLabel : label}
    </button>
  );
}
