import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { AuthProvider } from "../components/AuthContext";
import { CartProvider } from "../components/CartContext";
import { WishlistProvider } from "../components/WishlistContext";
import { AnalyticsBootstrap } from "../components/AnalyticsBootstrap";
import { HorizontalDragScroll } from "../components/HorizontalDragScroll";
import { SiteSettingsProvider } from "../components/SiteSettingsContext";
import { ThemeProvider, themeBootScript } from "../components/ThemeContext";
import { ConfirmProvider } from "../components/ui/ConfirmDialog";
import {
  fallbackCatalog,
  fetchCatalog,
  resolveMediaUrl
} from "../lib/catalog";
import { AppLocale, isAppLocale, messagesFor } from "../lib/i18n";
import "@fontsource-variable/nunito-sans";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-site-locale");
  const locale: AppLocale = isAppLocale(requestedLocale) ? requestedLocale : "en";
  const settings = await fetchCatalog()
    .then((catalog) => catalog.siteSettings)
    .catch(() => fallbackCatalog.siteSettings);
  const favicon = resolveMediaUrl(settings.faviconUrl ?? settings.logoUrl);

  return {
    title: {
      default: settings.title,
      template: `%s | ${settings.title}`
    },
    description:
      locale === "bn"
        ? "সহজ কেনাকাটা, পরিষ্কার মূল্য এবং নির্ভরযোগ্য অর্ডার ট্র্যাকিং।"
        : "A calm, modern ecommerce experience with order tracking.",
    icons: favicon ? { icon: favicon, shortcut: favicon, apple: favicon } : undefined
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7d2b5" },
    { media: "(prefers-color-scheme: dark)", color: "#120f0b" }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-site-locale");
  const locale: AppLocale = isAppLocale(requestedLocale) ? requestedLocale : "en";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Stamps the resolved theme on <html> before first paint so the page
            never flashes light on its way to dark. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messagesFor(locale)}
          timeZone="Asia/Dhaka"
        >
          <ThemeProvider>
            <ConfirmProvider>
              <AuthProvider>
                <SiteSettingsProvider>
                  <AnalyticsBootstrap />
                  <HorizontalDragScroll />
                  <WishlistProvider>
                    <CartProvider>{children}</CartProvider>
                  </WishlistProvider>
                </SiteSettingsProvider>
              </AuthProvider>
            </ConfirmProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
