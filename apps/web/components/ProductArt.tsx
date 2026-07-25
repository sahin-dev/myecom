"use client";

import { useEffect, useMemo, useState } from "react";
import { Product, resolveMediaUrl } from "../lib/catalog";

export function ProductArt({
  product,
  compact = false
}: {
  product: Product;
  compact?: boolean;
}) {
  const category = product.category?.slug ?? "grocery";
  const images = useMemo(
    () =>
      Array.from(
        new Set([
          product.imageUrl,
          ...(product.images ?? [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((image) => image.url)
        ].filter(Boolean) as string[])
      ).map(resolveMediaUrl),
    [product.imageUrl, product.images]
  );
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [product.id, images.join("|")]);

  const image = images[imageIndex];

  return (
    <div className={`packshot ${compact ? "compact" : ""} ${category}`} aria-hidden="true">
      {image ? (
        <img
          src={image}
          alt=""
          onError={() => setImageIndex((current) => current + 1)}
        />
      ) : (
        <>
          <div className="pack-shadow" />
          <div className="pack-body">
            <span>{product.category?.name ?? "Fresh"}</span>
            <strong>{product.name.split(" ").slice(0, 2).join(" ")}</strong>
          </div>
          <div className="pack-side" />
        </>
      )}
    </div>
  );
}
