import type { Metadata } from "next";
import { ShopPage } from "../../components/ShopPage";

export const metadata: Metadata = { title: "Shop" };

type ShopRouteProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function ShopRoute({ searchParams = {} }: ShopRouteProps) {
  const initialQuery = {
    search: first(searchParams.q),
    category: first(searchParams.category),
    brand: first(searchParams.brand),
    sort: first(searchParams.sort) || "featured",
    inStock: first(searchParams.inStock) === "true",
    minPrice: first(searchParams.minPrice),
    maxPrice: first(searchParams.maxPrice),
    page: Math.max(1, Number(first(searchParams.page)) || 1)
  };
  const routeKey = JSON.stringify(initialQuery);

  return <ShopPage key={routeKey} initialQuery={initialQuery} />;
}
