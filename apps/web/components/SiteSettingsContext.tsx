"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  SiteSettings,
  fallbackCatalog,
  fetchCatalog,
  resolveMediaUrl
} from "../lib/catalog";

type SiteSettingsContextValue = {
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(fallbackCatalog.siteSettings);

  useEffect(() => {
    fetchCatalog()
      .then((catalog) => setSettings(catalog.siteSettings))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const href = resolveMediaUrl(settings.faviconUrl ?? settings.logoUrl);
    if (!href) return;
    let favicon = document.querySelector<HTMLLinkElement>('link[data-dynamic-favicon="true"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.dataset.dynamicFavicon = "true";
      document.head.appendChild(favicon);
    }
    favicon.href = href;
  }, [settings.faviconUrl, settings.logoUrl]);

  const value = useMemo(() => ({ settings, setSettings }), [settings]);

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const value = useContext(SiteSettingsContext);
  if (!value) throw new Error("useSiteSettings must be used inside SiteSettingsProvider.");
  return value;
}
