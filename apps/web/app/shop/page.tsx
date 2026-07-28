import type { Metadata } from "next";
import { ShopPage } from "../../components/ShopPage";

export const metadata: Metadata = { title: "Shop" };

type ShopRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ShopRoute({ searchParams }: ShopRouteProps) {
  const query = await searchParams ?? {};
  const initialQuery = {
    search: first(query.q),
    category: first(query.category),
    brand: first(query.brand),
    sort: first(query.sort) || "featured",
    inStock: first(query.inStock) === "true",
    minPrice: first(query.minPrice),
    maxPrice: first(query.maxPrice),
    page: Math.max(1, Number(first(query.page)) || 1)
  };
  const routeKey = JSON.stringify(initialQuery);

  return <ShopPage key={routeKey} initialQuery={initialQuery} />;
}
