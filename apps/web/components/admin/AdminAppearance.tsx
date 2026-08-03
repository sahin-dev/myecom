"use client";

import { Monitor, Moon, Rows2, Rows3, Sun } from "lucide-react";
import { useTheme } from "../ThemeContext";

/**
 * Appearance controls for the admin shell: colour theme and row density.
 * Both persist to localStorage and apply instantly via data attributes on
 * <html>, so no surface needs to know they exist.
 */
export function AdminAppearance() {
  const { theme, setTheme, density, setDensity } = useTheme();

  return (
    <div className="admin-appearance">
      <div className="ui-segment" role="group" aria-label="Colour theme">
        <button
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => setTheme("light")}
          title="Light theme"
        >
          <Sun size={14} />
          <span className="ui-visually-hidden">Light theme</span>
        </button>
        <button
          type="button"
          aria-pressed={theme === "system"}
          onClick={() => setTheme("system")}
          title="Match system"
        >
          <Monitor size={14} />
          <span className="ui-visually-hidden">Match system theme</span>
        </button>
        <button
          type="button"
          aria-pressed={theme === "dark"}
          onClick={() => setTheme("dark")}
          title="Dark theme"
        >
          <Moon size={14} />
          <span className="ui-visually-hidden">Dark theme</span>
        </button>
      </div>

      <div className="ui-segment" role="group" aria-label="Row density">
        <button
          type="button"
          aria-pressed={density === "comfortable"}
          onClick={() => setDensity("comfortable")}
          title="Comfortable density"
        >
          <Rows2 size={14} />
          <span className="ui-visually-hidden">Comfortable density</span>
        </button>
        <button
          type="button"
          aria-pressed={density === "compact"}
          onClick={() => setDensity("compact")}
          title="Compact density"
        >
          <Rows3 size={14} />
          <span className="ui-visually-hidden">Compact density</span>
        </button>
      </div>
    </div>
  );
}
