"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

const THEME_KEY = "my-ecom-theme";
const DENSITY_KEY = "my-ecom-density";

/**
 * Runs before first paint to stamp the resolved theme onto <html>, so the page
 * never flashes light before hydration corrects it. Kept as a string because it
 * has to be inlined into the document head.
 */
export const themeBootScript = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_KEY}") || "system";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute(
      "data-density",
      localStorage.getItem("${DENSITY_KEY}") || "comfortable"
    );
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-density", "comfortable");
  }
})();
`;

type ThemeContextValue = {
  theme: ThemePreference;
  /** The theme actually applied once "system" has been resolved. */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  density: Density;
  setDensity: (density: Density) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads a persisted preference during the very first render on the client. */
function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (window.localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* These are lazy initialisers on purpose. Defaulting to "system"/false and
     syncing in an effect meant the first commit wrote data-theme="light" over
     whatever the boot script had already resolved, and only corrected it on a
     later render — the white flash on reload. Seeding from storage up front
     makes the first client render agree with the boot script. */
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStored<ThemePreference>(THEME_KEY, "system")
  );
  const [density, setDensityState] = useState<Density>(() =>
    readStored<Density>(DENSITY_KEY, "comfortable")
  );
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Keep the media query in sync for anyone sitting on "system".
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable (private mode); the in-memory value still applies */
    }
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* as above */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, density, setDensity }),
    [theme, resolvedTheme, setTheme, density, setDensity]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider.");
  return context;
}
