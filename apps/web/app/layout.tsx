import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../components/AuthContext";
import { CartProvider } from "../components/CartContext";
import { WishlistProvider } from "../components/WishlistContext";
import { AnalyticsBootstrap } from "../components/AnalyticsBootstrap";
import { HorizontalDragScroll } from "../components/HorizontalDragScroll";
import { SiteSettingsProvider } from "../components/SiteSettingsContext";
import {
  fallbackCatalog,
  fetchCatalog,
  resolveMediaUrl
} from "../lib/catalog";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchCatalog()
    .then((catalog) => catalog.siteSettings)
    .catch(() => fallbackCatalog.siteSettings);
  const favicon = resolveMediaUrl(settings.faviconUrl ?? settings.logoUrl);

  return {
    title: {
      default: settings.title,
      template: `%s | ${settings.title}`
    },
    description: "A calm, modern ecommerce experience with order tracking.",
    icons: favicon ? { icon: favicon, shortcut: favicon, apple: favicon } : undefined
  };
}

export const viewport: Viewport = {
  themeColor: "#e7d2b5"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SiteSettingsProvider>
            <AnalyticsBootstrap />
            <HorizontalDragScroll />
            <WishlistProvider>
              <CartProvider>{children}</CartProvider>
            </WishlistProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
