import { Storefront } from "../components/Storefront";
import { Catalog, fallbackCatalog } from "../lib/catalog";

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

export default async function Home() {
  return <Storefront initialCatalog={await homepageCatalog()} />;
}
