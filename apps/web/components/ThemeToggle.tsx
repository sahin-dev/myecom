"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeContext";

/**
 * Storefront theme switch. Flips between light and dark, following the system
 * preference until the visitor expresses one of their own.
 *
 * Renders a stable placeholder until mounted: the resolved theme is only known
 * on the client, and swapping the icon during hydration causes a mismatch.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
    >
      {/* Both glyphs are always mounted and cross-faded, so the control never
          reflows and the swap reads as a transition rather than a redraw. */}
      <Sun size={17} className="theme-toggle__sun" aria-hidden="true" />
      <Moon size={17} className="theme-toggle__moon" aria-hidden="true" />
    </button>
  );
}
