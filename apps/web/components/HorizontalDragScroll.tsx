"use client";

import { useEffect } from "react";

const dragScrollTargets = [
  ".horizontal-rail-viewport",
  ".online-payment-options > div",
  ".thumbnail-rail",
  ".modern-product-grid",
  ".category-explorer-tabs",
  ".category-nav",
  ".filter-row",
  ".product-detail-index",
  ".customer-segment-tabs",
  ".account-section-nav nav",
  ".admin-local-nav",
  ".admin-return-filters",
  ".admin-segmented",
  ".admin-table-wrap",
  ".admin-sidebar",
  ".admin-content-tabs",
  ".admin-editor-nav",
  ".admin-subnav",
  ".promotion-filter-tabs",
  ".review-filter-tabs",
  ".breadcrumbs"
].join(", ");

const formControlSelector = "input, textarea, select, option, [contenteditable='true']";

function canDragScroll(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth + 2;
}

function refreshDragAvailability(element: HTMLElement) {
  element.classList.toggle("can-drag-scroll", canDragScroll(element));
}

export function HorizontalDragScroll() {
  useEffect(() => {
    const teardowns = new Map<HTMLElement, () => void>();
    let scheduledScan = 0;

    function bind(element: HTMLElement) {
      if (teardowns.has(element)) {
        refreshDragAvailability(element);
        return;
      }

      let activePointerId: number | null = null;
      let startX = 0;
      let startScrollLeft = 0;
      let nextScrollLeft = 0;
      let animationFrame = 0;
      let capturedPointer = false;
      let moved = false;
      let resetClickGuard = 0;

      element.classList.add("horizontal-drag-scroll");
      refreshDragAvailability(element);

      const resizeObserver = new ResizeObserver(() => refreshDragAvailability(element));
      resizeObserver.observe(element);

      const applyScroll = () => {
        animationFrame = 0;
        element.scrollLeft = nextScrollLeft;
      };

      const stopDragging = (event?: PointerEvent) => {
        if (activePointerId === null) return;
        if (event && event.pointerId !== activePointerId) return;

        try {
          if (event && capturedPointer && element.hasPointerCapture?.(event.pointerId)) {
            element.releasePointerCapture(event.pointerId);
          }
        } catch {
          // The browser can release pointer capture automatically during navigation.
        }

        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        activePointerId = null;
        capturedPointer = false;
        element.classList.remove("is-drag-scrolling");
        window.clearTimeout(resetClickGuard);
        resetClickGuard = window.setTimeout(() => {
          moved = false;
        }, 0);
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        if (!canDragScroll(element)) return;
        if ((event.target as Element | null)?.closest(formControlSelector)) return;

        activePointerId = event.pointerId;
        startX = event.clientX;
        startScrollLeft = element.scrollLeft;
        nextScrollLeft = startScrollLeft;
        capturedPointer = false;
        moved = false;
      };

      const onPointerMove = (event: PointerEvent) => {
        if (activePointerId === null || event.pointerId !== activePointerId) return;

        const distance = event.clientX - startX;
        if (Math.abs(distance) < 4) return;

        if (!moved) {
          moved = true;
          capturedPointer = true;
          element.classList.add("is-drag-scrolling");
          element.setPointerCapture?.(event.pointerId);
        }
        nextScrollLeft = startScrollLeft - distance;
        if (!animationFrame) {
          animationFrame = window.requestAnimationFrame(applyScroll);
        }
        event.preventDefault();
      };

      const onClickCapture = (event: MouseEvent) => {
        if (!moved) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        moved = false;
      };

      element.addEventListener("pointerdown", onPointerDown);
      element.addEventListener("pointermove", onPointerMove);
      element.addEventListener("pointerup", stopDragging);
      element.addEventListener("pointercancel", stopDragging);
      element.addEventListener("click", onClickCapture, true);
      element.addEventListener("dragstart", onClickCapture, true);

      teardowns.set(element, () => {
        window.clearTimeout(resetClickGuard);
        window.cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        element.classList.remove("horizontal-drag-scroll", "can-drag-scroll", "is-drag-scrolling");
        element.removeEventListener("pointerdown", onPointerDown);
        element.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("pointerup", stopDragging);
        element.removeEventListener("pointercancel", stopDragging);
        element.removeEventListener("click", onClickCapture, true);
        element.removeEventListener("dragstart", onClickCapture, true);
      });
    }

    function scan() {
      document.querySelectorAll<HTMLElement>(dragScrollTargets).forEach(bind);
    }

    function scheduleScan() {
      if (scheduledScan) return;
      scheduledScan = window.requestAnimationFrame(() => {
        scheduledScan = 0;
        scan();
      });
    }

    scan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(scheduledScan);
      teardowns.forEach((teardown) => teardown());
    };
  }, []);

  return null;
}
