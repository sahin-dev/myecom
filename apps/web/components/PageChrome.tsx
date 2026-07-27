"use client";

import Link from "next/link";
import {
  Facebook,
  Home,
  Heart,
  Grid2X2,
  Instagram,
  Menu,
  MessageCircle,
  ShoppingBag,
  Truck,
  UserRound,
  X,
  Youtube
} from "lucide-react";
import { useState } from "react";
import { Category, SiteSettings, resolveMediaUrl } from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useSiteSettings } from "./SiteSettingsContext";
import { useWishlist } from "./WishlistContext";
import { SearchAutocomplete } from "./SearchAutocomplete";

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
  const { savedCount } = useWishlist();
  const { user, loading: authLoading } = useAuth();
  const { settings: defaultSettings } = useSiteSettings();
  const settings = siteSettings ?? defaultSettings;
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <>
      <div className="top-note">
        <span>{settings.announcement}</span>
        <Link href={settings.announcementLinkHref}>{settings.announcementLinkLabel}</Link>
      </div>
      <header className={`site-header ${home ? "home-header" : "inner-header"}`}>
        <BrandIdentity settings={settings} />
        <SearchAutocomplete categories={categories} />
        <nav className="header-actions" aria-label="Primary navigation">
          <Link href="/shop" title="Shop">
            <Grid2X2 size={20} />
            <span>Shop</span>
          </Link>
          <Link href="/track-order" title="Track order">
            <Truck size={20} />
            <span>Track</span>
          </Link>
          <Link
            href={user || authLoading ? "/account" : "/login"}
            title={user || authLoading ? "Account" : "Sign in to account"}
          >
            <UserRound size={20} />
            <span>Account</span>
          </Link>
          <Link className="saved-link" href="/wishlist" title={`${savedCount} saved products`}>
            <Heart size={20} />
            <span>Saved</span>
            {savedCount ? <b className="nav-count">{savedCount > 99 ? "99+" : savedCount}</b> : null}
          </Link>
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
        <button
          className="mobile-category-toggle"
          type="button"
          onClick={() => setCategoriesOpen((current) => !current)}
          aria-expanded={categoriesOpen}
        >
          {categoriesOpen ? <X size={17} /> : <Menu size={17} />}
          Categories
        </button>
        <div className={categoriesOpen ? "category-nav-links open" : "category-nav-links"}>
          <Link href="/shop" onClick={() => setCategoriesOpen(false)}>Shop all</Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              onClick={() => setCategoriesOpen(false)}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/"><Home size={19} /><span>Home</span></Link>
        <Link href="/shop"><Grid2X2 size={19} /><span>Shop</span></Link>
        <Link href="/wishlist">
          <Heart size={19} />
          <span>Saved</span>
          {savedCount ? <b>{savedCount > 99 ? "99+" : savedCount}</b> : null}
        </Link>
        <Link href={user || authLoading ? "/account" : "/login"}><UserRound size={19} /><span>Account</span></Link>
        <button type="button" onClick={() => setIsOpen(true)} aria-label={`Open cart with ${cartCount} items`}>
          <ShoppingBag size={19} /><span>Cart</span><b>{cartCount}</b>
        </button>
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
  const socialLinks: Array<{ label: string; href: string; icon: React.ReactNode }> = [];
  if (settings.facebookUrl) socialLinks.push({ label: "Facebook", href: settings.facebookUrl, icon: <Facebook size={18} /> });
  if (settings.instagramUrl) socialLinks.push({ label: "Instagram", href: settings.instagramUrl, icon: <Instagram size={18} /> });
  if (settings.youtubeUrl) socialLinks.push({ label: "YouTube", href: settings.youtubeUrl, icon: <Youtube size={18} /> });
  if (settings.whatsappUrl) socialLinks.push({ label: "WhatsApp", href: settings.whatsappUrl, icon: <MessageCircle size={18} /> });

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandIdentity settings={settings} />
        <p>Better pantry shopping for everyday homes.</p>
        {socialLinks.length ? (
          <div className="footer-socials" aria-label="Social media">
            {socialLinks.map((item) => (
              <a href={item.href} key={item.label} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                {item.icon}
              </a>
            ))}
          </div>
        ) : null}
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
        <span>{new Date().getFullYear()} {settings.title}</span>
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
    <Link className={`brand-word ${className}`} href="/" aria-label={`${settings.title} home`}>
      {logo ? <img src={logo} alt="" /> : <span>{initials || "ME"}</span>}
      <strong>{settings.title}</strong>
    </Link>
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
        <Link href={item.href} key={item.label}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
