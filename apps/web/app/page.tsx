import { Storefront } from "../components/Storefront";
import { fallbackCatalog, fetchCatalog } from "../lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await fetchCatalog().catch(() => fallbackCatalog);
  return <Storefront initialCatalog={catalog} />;
}
