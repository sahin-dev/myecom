import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../components/AuthContext";
import { CartProvider } from "../components/CartContext";
import { WishlistProvider } from "../components/WishlistContext";
import { AnalyticsBootstrap } from "../components/AnalyticsBootstrap";
import { SiteSettingsProvider } from "../components/SiteSettingsContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Ecom",
  description: "A calm, modern ecommerce experience with order tracking."
};

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
            <WishlistProvider>
              <CartProvider>{children}</CartProvider>
            </WishlistProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
