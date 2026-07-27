"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, KeyboardEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

export function HorizontalRail({
  children,
  label,
  variant
}: {
  children: ReactNode;
  label: string;
  variant: "categories" | "products" | "brands" | "reviews";
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [canMovePrevious, setCanMovePrevious] = useState(false);
  const [canMoveNext, setCanMoveNext] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const itemCount = Children.count(children);

  const measure = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const pageWidth = Math.max(1, element.clientWidth * 0.9);
    setCanMovePrevious(element.scrollLeft > 4);
    setCanMoveNext(element.scrollLeft < maxScroll - 4);
    setPages(Math.max(1, Math.ceil(element.scrollWidth / pageWidth)));
    setPage(Math.min(Math.max(1, Math.round(element.scrollLeft / pageWidth) + 1), Math.max(1, Math.ceil(element.scrollWidth / pageWidth))));
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [itemCount, measure]);

  function move(direction: -1 | 1) {
    const element = viewport.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.9,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  }

  return (
    <div className={`horizontal-rail ${variant}`}>
      <button
        className="horizontal-rail-control previous"
        type="button"
        onClick={() => move(-1)}
        disabled={!canMovePrevious}
        aria-label={`Show previous ${label}`}
      >
        <ChevronLeft size={20} />
      </button>
      <div
        className="horizontal-rail-viewport"
        ref={viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
        onKeyDown={handleKeyboard}
      >
        <div className="horizontal-rail-track">{children}</div>
      </div>
      <button
        className="horizontal-rail-control next"
        type="button"
        onClick={() => move(1)}
        disabled={!canMoveNext}
        aria-label={`Show more ${label}`}
      >
        <ChevronRight size={20} />
      </button>
      {pages > 1 ? (
        <span className="horizontal-rail-status" aria-live="polite">
          {page} / {pages}
        </span>
      ) : null}
    </div>
  );
}
