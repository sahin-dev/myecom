"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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
import { useEffect, useRef, useState } from "react";
import { Category, SiteSettings, resolveMediaUrl } from "../lib/catalog";
import { AppLocale, localizedHref, localizeCategory, localizeEntity } from "../lib/i18n";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useSiteSettings } from "./SiteSettingsContext";
import { useWishlist } from "./WishlistContext";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

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
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Header");
  const common = useTranslations("Common");
  const href = (value: string) => localizedHref(value, locale);
  const settings = localizeEntity(siteSettings ?? defaultSettings, locale);
  const localizedCategories = categories.map((category) => localizeCategory(category, locale));
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoryNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!categoriesOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && categoryNavRef.current?.contains(target)) return;
      setCategoriesOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [categoriesOpen]);

  return (
    <>
      <div className="top-note">
        <span>{settings.announcement}</span>
        <Link href={href(settings.announcementLinkHref)}>{settings.announcementLinkLabel}</Link>
      </div>
      <header className={`site-header ${home ? "home-header" : "inner-header"}`}>
        <BrandIdentity settings={settings} />
        <SearchAutocomplete categories={localizedCategories} />
        <nav className="header-actions" aria-label={t("primaryNavigation")}>
          <Link href={href("/shop")} title={common("shop")}>
            <Grid2X2 size={20} />
            <span>{common("shop")}</span>
          </Link>
          <Link href={href("/track-order")} title={t("trackOrder")}>
            <Truck size={20} />
            <span>{t("track")}</span>
          </Link>
          <Link
            href={href(user || authLoading ? "/account" : "/login")}
            title={user || authLoading ? common("account") : t("signIn")}
          >
            <UserRound size={20} />
            <span>{common("account")}</span>
          </Link>
          <Link className="saved-link" href={href("/wishlist")} title={t("savedProducts", { count: savedCount })}>
            <Heart size={20} />
            <span>{common("saved")}</span>
            {savedCount ? <b className="nav-count">{savedCount > 99 ? "99+" : savedCount}</b> : null}
          </Link>
          {/* Cart sits with the destinations it belongs to and mirrors their
              icon-over-label shape; the badge is the shared .nav-count used by
              Saved, so the two read the same way. */}
          <button
            className="cart-button"
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={t("openCart", { count: cartCount })}
          >
            <ShoppingBag size={20} />
            <span>{common("cart")}</span>
            {cartCount ? <b className="nav-count">{cartCount > 99 ? "99+" : cartCount}</b> : null}
          </button>
          {/* Separates destinations from utilities so the right side reads as
              two small groups rather than one long row of controls. */}
          <span className="header-actions-divider" aria-hidden="true" />
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>
      </header>
      <nav ref={categoryNavRef} className={`category-nav ${home ? "home-category-nav" : ""}`} aria-label={t("shopCategories")}>
        <button
          className="mobile-category-toggle"
          type="button"
          onClick={() => setCategoriesOpen((current) => !current)}
          aria-expanded={categoriesOpen}
        >
          {categoriesOpen ? <X size={17} /> : <Menu size={17} />}
          {t("categories")}
        </button>
        <div className={categoriesOpen ? "category-nav-links open" : "category-nav-links"}>
          <Link href={href("/shop")} onClick={() => setCategoriesOpen(false)}>{t("shopAll")}</Link>
          {localizedCategories.map((category) => (
            <Link
              key={category.id}
              href={href(`/shop?category=${category.slug}`)}
              onClick={() => setCategoriesOpen(false)}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
      <nav className="mobile-bottom-nav" aria-label={t("mobileNavigation")}>
        <Link href={href("/")}><Home size={19} /><span>{common("home")}</span></Link>
        <Link href={href("/shop")}><Grid2X2 size={19} /><span>{common("shop")}</span></Link>
        <Link href={href("/wishlist")}>
          <Heart size={19} />
          <span>{common("saved")}</span>
          {savedCount ? <b>{savedCount > 99 ? "99+" : savedCount}</b> : null}
        </Link>
        <Link href={href(user || authLoading ? "/account" : "/login")}><UserRound size={19} /><span>{common("account")}</span></Link>
        <button type="button" onClick={() => setIsOpen(true)} aria-label={t("openCart", { count: cartCount })}>
          <ShoppingBag size={19} /><span>{common("cart")}</span><b>{cartCount}</b>
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
  const locale = useLocale() as AppLocale;
  const common = useTranslations("Common");
  const t = useTranslations("Footer");
  const header = useTranslations("Header");
  const href = (value: string) => localizedHref(value, locale);
  const settings = localizeEntity(siteSettings ?? defaultSettings, locale);
  const localizedCategories = categories.map((category) => localizeCategory(category, locale));
  const socialLinks: Array<{ label: string; href: string; icon: React.ReactNode }> = [];
  if (settings.facebookUrl) socialLinks.push({ label: "Facebook", href: settings.facebookUrl, icon: <Facebook size={18} /> });
  if (settings.instagramUrl) socialLinks.push({ label: "Instagram", href: settings.instagramUrl, icon: <Instagram size={18} /> });
  if (settings.youtubeUrl) socialLinks.push({ label: "YouTube", href: settings.youtubeUrl, icon: <Youtube size={18} /> });
  if (settings.whatsappUrl) socialLinks.push({ label: "WhatsApp", href: settings.whatsappUrl, icon: <MessageCircle size={18} /> });

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandIdentity settings={settings} />
        <p>{t("tagline")}</p>
        {socialLinks.length ? (
          <div className="footer-socials" aria-label={t("socialMedia")}>
            {socialLinks.map((item) => (
              <a href={item.href} key={item.label} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                {item.icon}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <FooterColumn
        title={common("shop")}
        items={localizedCategories.slice(0, 5).map((category) => ({
          label: category.name,
          href: href(`/shop?category=${category.slug}`)
        }))}
      />
      <FooterColumn
        title={t("help")}
        items={[
          { label: header("trackOrder"), href: href("/track-order") },
          { label: t("delivery"), href: href("/delivery") },
          { label: t("returns"), href: href("/returns") },
          { label: t("contact"), href: href("/contact") }
        ]}
      />
      <FooterColumn
        title={t("company")}
        items={[
          { label: t("about"), href: href("/about") },
          { label: t("brands"), href: href("/#brands") },
          { label: t("privacy"), href: href("/privacy") },
          { label: t("terms"), href: href("/terms") }
        ]}
      />
      <div className="footer-bottom">
        <span>{new Date().getFullYear()} {settings.title}</span>
        <span>{t("thoughtful")}</span>
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
  const locale = useLocale() as AppLocale;
  const initials = settings.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const logo = resolveMediaUrl(settings.logoUrl);

  return (
    <Link className={`brand-word ${className}`} href={localizedHref("/", locale)} aria-label={`${settings.title} home`}>
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
