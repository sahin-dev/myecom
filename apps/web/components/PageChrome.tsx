"use client";

import {
  Heart,
  Grid2X2,
  Search,
  ShoppingBag,
  Truck,
  UserRound
} from "lucide-react";
import { Category, SiteSettings, resolveMediaUrl } from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useSiteSettings } from "./SiteSettingsContext";

export function PageHeader({
  categories,
  siteSettings,
  home = false
}: {
  categories: Category[];
  siteSettings?: SiteSettings;
  home?: boolean;
}) {
  const { cartCount, setIsOpen } = useCart();
  const { user } = useAuth();
  const { settings: defaultSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSettings;

  return (
    <>
      <div className="top-note">
        <span>{settings.announcement}</span>
        <a href={settings.announcementLinkHref}>{settings.announcementLinkLabel}</a>
      </div>
      <header className={`site-header ${home ? "home-header" : "inner-header"}`}>
        <BrandIdentity settings={settings} />
        <form className="search-shell" action="/shop" method="get">
          <Search size={19} />
          <input name="q" placeholder="Search pantry essentials" />
        </form>
        <nav className="header-actions" aria-label="Primary navigation">
          <a href="/shop" title="Shop">
            <Grid2X2 size={20} />
            <span>Shop</span>
          </a>
          <a href="/track-order" title="Track order">
            <Truck size={20} />
            <span>Track</span>
          </a>
          <a href={user ? "/account" : "/login"} title={user ? "Account" : "Sign in"}>
            <UserRound size={20} />
            <span>{user ? "Account" : "Sign in"}</span>
          </a>
          <a href="/wishlist" title="Wishlist">
            <Heart size={20} />
            <span>Saved</span>
          </a>
          <button
            className="cart-button"
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={`Open cart with ${cartCount} items`}
          >
            <ShoppingBag size={20} />
            <span>{cartCount}</span>
          </button>
        </nav>
      </header>
      <nav className="category-nav" aria-label="Shop categories">
        <a href="/shop">Shop all</a>
        {categories.slice(0, 7).map((category) => (
          <a key={category.id} href={`/shop?category=${category.slug}`}>
            {category.name}
          </a>
        ))}
      </nav>
    </>
  );
}

export function PageFooter({
  categories,
  siteSettings
}: {
  categories: Category[];
  siteSettings?: SiteSettings;
}) {
  const { settings: defaultSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSettings;

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandIdentity settings={settings} />
        <p>Better pantry shopping for everyday homes.</p>
      </div>
      <FooterColumn
        title="Shop"
        items={categories.slice(0, 5).map((category) => ({
          label: category.name,
          href: `/shop?category=${category.slug}`
        }))}
      />
      <FooterColumn
        title="Help"
        items={[
          { label: "Track order", href: "/track-order" },
          { label: "Delivery", href: "/delivery" },
          { label: "Returns", href: "/returns" },
          { label: "Contact", href: "/contact" }
        ]}
      />
      <FooterColumn
        title="Company"
        items={[
          { label: "About", href: "/about" },
          { label: "Our brands", href: "/#brands" },
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" }
        ]}
      />
      <div className="footer-bottom">
        <span>2026 My Ecom</span>
        <span>Made for thoughtful shopping.</span>
      </div>
    </footer>
  );
}

export function BrandIdentity({
  settings,
  className = ""
}: {
  settings: SiteSettings;
  className?: string;
}) {
  const initials = settings.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const logo = resolveMediaUrl(settings.logoUrl);

  return (
    <a className={`brand-word ${className}`} href="/" aria-label={`${settings.title} home`}>
      {logo ? <img src={logo} alt="" /> : <span>{initials || "ME"}</span>}
      <strong>{settings.title}</strong>
    </a>
  );
}

function FooterColumn({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="footer-column">
      <h3>{title}</h3>
      {items.map((item) => (
        <a href={item.href} key={item.label}>
          {item.label}
        </a>
      ))}
    </div>
  );
}
