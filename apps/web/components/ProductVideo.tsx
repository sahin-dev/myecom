"use client";

import { Play } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

const HOVER_INTENT_MS = 200;

/**
 * Promo clip overlaid on the product artwork.
 *
 * `children` is the existing artwork and is always rendered — the video sits on
 * top of it and fades in. So when a product has no clip, or the visitor is on a
 * touch device, or the file fails to load, what remains is exactly the markup
 * that was there before this component existed.
 */
export function ProductVideo({
  src,
  poster,
  mode = "hover",
  label,
  children
}: {
  src?: string | null;
  /** Falls back to the product's first image so there is no blank first frame. */
  poster?: string | null;
  /** "hover" for cards, "click" for the detail page. */
  mode?: "hover" | "click";
  label: string;
  children: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  // Hover is meaningless on touch, and autoplay is unwelcome for anyone who has
  // asked for reduced motion — both fall back to the plain artwork.
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCanHover(hoverQuery.matches && !motionQuery.matches);
    sync();
    hoverQuery.addEventListener("change", sync);
    motionQuery.addEventListener("change", sync);
    return () => {
      hoverQuery.removeEventListener("change", sync);
      motionQuery.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(intentTimer.current), []);

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setActive(true);
    // play() rejects if the element is detached or autoplay is refused; either
    // way the artwork underneath is still showing, so there is nothing to undo.
    void video.play().catch(() => setActive(false));
  }, []);

  const stop = useCallback(() => {
    window.clearTimeout(intentTimer.current);
    const video = videoRef.current;
    setActive(false);
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, []);

  if (!src || failed) return <>{children}</>;

  const hoverProps =
    mode === "hover" && canHover
      ? {
          // A delay means sweeping the cursor across a grid does not fire a
          // request per card — only a deliberate pause loads anything.
          onPointerEnter: () => {
            window.clearTimeout(intentTimer.current);
            intentTimer.current = setTimeout(start, HOVER_INTENT_MS);
          },
          onPointerLeave: stop,
          onFocus: start,
          onBlur: stop
        }
      : {};

  const clickable = mode === "click" || !canHover;

  return (
    <div className={`product-video${active ? " is-playing" : ""}`} {...hoverProps}>
      {children}
      <video
        ref={videoRef}
        className="product-video__media"
        src={src}
        poster={poster ?? undefined}
        // preload="none" keeps a 48-product grid from fetching 48 videos.
        preload="none"
        muted
        loop
        playsInline
        tabIndex={-1}
        aria-hidden={!active}
        onError={() => setFailed(true)}
      />
      {clickable ? (
        <button
          type="button"
          className="product-video__toggle"
          aria-label={label}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (active) stop();
            else start();
          }}
        >
          {active ? null : <Play size={18} fill="currentColor" />}
        </button>
      ) : null}
    </div>
  );
}
