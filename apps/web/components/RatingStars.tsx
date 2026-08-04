"use client";

import { Star } from "lucide-react";

/**
 * Five-star rating with a true fractional fill: a clipped layer of solid stars
 * sits over a layer of outlines, so 4.3 renders as 4.3 rather than rounding to
 * the nearest whole or half star.
 *
 * Presentational only — the caller supplies the already-translated `label`, so
 * this stays free of i18n wiring and works in any namespace.
 */
export function RatingStars({
  rating,
  count,
  label,
  countLabel,
  size = 14,
  showCount = true
}: {
  rating?: number | null;
  count?: number | null;
  /** Accessible description, e.g. "4.5 rating · 12 reviews". */
  label: string;
  /** Translated, pluralised count. Falls back to the bare number. */
  countLabel?: string;
  size?: number;
  showCount?: boolean;
}) {
  const value = Math.min(5, Math.max(0, rating ?? 0));
  const percent = (value / 5) * 100;

  return (
    <span className="rating-stars" aria-label={label} title={label}>
      <span className="rating-stars__track" aria-hidden="true">
        <span className="rating-stars__layer">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} size={size} strokeWidth={1.75} />
          ))}
        </span>
        <span className="rating-stars__layer is-filled" style={{ width: `${percent}%` }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} size={size} strokeWidth={1.75} fill="currentColor" />
          ))}
        </span>
      </span>
      <b className="rating-stars__value">{value.toFixed(1)}</b>
      {showCount && count ? (
        <small className="rating-stars__count">{countLabel ?? count}</small>
      ) : null}
    </span>
  );
}
