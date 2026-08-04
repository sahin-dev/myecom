import en from "../messages/en.json";
import bn from "../messages/bn.json";
import type { Catalog, CatalogSearchResult, Category, LocalizedTranslations, Product } from "./catalog";

export const locales = ["en", "bn"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const localeCookie = "MY_ECOM_LOCALE";

export function isAppLocale(value?: string | null): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function messagesFor(locale: AppLocale) {
  return locale === "bn" ? bn : en;
}

export function localeFromPathname(pathname: string): AppLocale {
  return pathname === "/bn" || pathname.startsWith("/bn/") ? "bn" : "en";
}

export function withoutLocalePrefix(pathname: string) {
  if (pathname === "/bn") return "/";
  return pathname.startsWith("/bn/") ? pathname.slice(3) || "/" : pathname;
}

export function localizedHref(href: string, locale: AppLocale) {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/") || href.startsWith("/uploads/")) {
    return href;
  }
  const [path, suffix = ""] = href.split(/(?=[?#])/u, 2);
  const cleanPath = withoutLocalePrefix(path);
  return `${locale === "bn" ? `/bn${cleanPath === "/" ? "" : cleanPath}` : cleanPath}${suffix}` || "/";
}

export function localeCode(locale: AppLocale) {
  return locale === "bn" ? "bn-BD" : "en-BD";
}

type Translatable = { translations?: LocalizedTranslations | null };

export function localizeEntity<T extends Translatable>(entity: T, locale: AppLocale): T {
  if (locale === "en") return entity;
  const translated = entity.translations?.[locale];
  if (!translated) return entity;
  const allowed = Object.fromEntries(
    Object.entries(translated).filter(([, value]) =>
      typeof value === "string" || Array.isArray(value) || (value !== null && typeof value === "object")
    )
  );
  return { ...entity, ...allowed } as T;
}

export function localizeCategory(category: Category, locale: AppLocale) {
  return localizeEntity(category, locale);
}

export function localizeProduct(product: Product, locale: AppLocale): Product {
  const localized = localizeEntity(product, locale);
  return {
    ...localized,
    brand: localized.brand ? localizeEntity(localized.brand, locale) : localized.brand,
    category: localized.category ? localizeCategory(localized.category, locale) : localized.category,
    variants: localized.variants?.map((variant) => localizeEntity(variant, locale)),
    comboProducts: localized.comboProducts?.map((item) => localizeEntity(item as typeof item & Translatable, locale))
  };
}

export function localizeCatalog(catalog: Catalog, locale: AppLocale): Catalog {
  return {
    ...catalog,
    brands: catalog.brands.map((brand) => localizeEntity(brand, locale)),
    categories: catalog.categories.map((category) => localizeCategory(category, locale)),
    newlyLaunched: catalog.newlyLaunched.map((product) => localizeProduct(product, locale)),
    trendingProducts: catalog.trendingProducts.map((product) => localizeProduct(product, locale)),
    topSellingProducts: catalog.topSellingProducts.map((product) => localizeProduct(product, locale)),
    comboDeals: catalog.comboDeals.map((product) => localizeProduct(product, locale)),
    certifiedProducts: catalog.certifiedProducts.map((product) => localizeProduct(product, locale)),
    justForYou: catalog.justForYou.map((product) => localizeProduct(product, locale)),
    categoryShowcase: catalog.categoryShowcase.map((shelf) => ({
      ...shelf,
      category: localizeCategory(shelf.category, locale),
      products: shelf.products.map((product) => localizeProduct(product, locale))
    })),
    banners: catalog.banners.map((banner) => localizeEntity(banner, locale)),
    homeSections: catalog.homeSections.map((section) => localizeEntity(section, locale)),
    checkoutMethods: catalog.checkoutMethods.map((method) => localizeEntity(method, locale)),
    siteSettings: localizeEntity(catalog.siteSettings, locale)
  };
}

export function localizeSearchResult(result: CatalogSearchResult, locale: AppLocale): CatalogSearchResult {
  return {
    ...result,
    products: result.products.map((product) => localizeProduct(product, locale)),
    facets: {
      brands: result.facets.brands.map((brand) => localizeEntity(brand, locale)),
      categories: result.facets.categories.map((category) => localizeCategory(category, locale))
    }
  };
}
