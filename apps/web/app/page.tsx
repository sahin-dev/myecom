import type { Metadata } from "next";
import { cache } from "react";
import { Storefront } from "../components/Storefront";
import { Catalog, fallbackCatalog, resolveMediaUrl } from "../lib/catalog";

export const dynamic = "force-dynamic";

async function homepageCatalog(): Promise<Catalog> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiBase}/api/catalog/home`, { cache: "no-store" });
    if (!response.ok) return fallbackCatalog;
    return response.json() as Promise<Catalog>;
  } catch {
    return fallbackCatalog;
  }
}

const getHomepageCatalog = cache(homepageCatalog);

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getHomepageCatalog();
  const title = `${catalog.siteSettings.title} - Pantry essentials delivered`;
  const description =
    "Shop pantry essentials, trusted grocery brands, combo deals, and everyday ingredients with clear delivery and order tracking.";
  const heroImage = resolveMediaUrl(catalog.banners[0]?.imageUrl);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      type: "website",
      images: heroImage ? [{ url: heroImage }] : undefined
    }
  };
}

export default async function Home() {
  return <Storefront initialCatalog={await getHomepageCatalog()} />;
}
