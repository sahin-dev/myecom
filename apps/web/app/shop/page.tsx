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
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialQuery = {
    search: first(resolvedSearchParams.q),
    category: first(resolvedSearchParams.category),
    brand: first(resolvedSearchParams.brand),
    sort: first(resolvedSearchParams.sort) || "featured",
    inStock: first(resolvedSearchParams.inStock) === "true",
    minPrice: first(resolvedSearchParams.minPrice),
    maxPrice: first(resolvedSearchParams.maxPrice),
    page: Math.max(1, Number(first(resolvedSearchParams.page)) || 1)
  };
  const routeKey = JSON.stringify(initialQuery);

  return <ShopPage key={routeKey} initialQuery={initialQuery} />;
}
