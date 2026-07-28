import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProductDetails } from "../../../components/ProductDetails";
import {
  fallbackCatalog,
  fetchCatalog,
  fetchProduct
} from "../../../lib/catalog";

const productForPage = cache(fetchProduct);

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string; quantity?: string }>;
};

export async function generateMetadata({
  params
}: Pick<ProductPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  return productForPage(slug)
    .then((product) => ({
      title: product.name,
      description: product.description,
      openGraph: {
        title: product.name,
        description: product.description,
        images: product.imageUrl ? [product.imageUrl] : undefined
      }
    }))
    .catch(() => ({ title: "Product" }));
}

export default async function ProductPage({
  params,
  searchParams
}: ProductPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await productForPage(slug).catch(() => null);
  if (!product) notFound();
  const catalog = await fetchCatalog().catch(() => fallbackCatalog);
  const quantity = Number(query.quantity);

  return (
    <ProductDetails
      slug={slug}
      initialProduct={product}
      initialCatalog={catalog}
      initialVariantId={query.variant}
      initialQuantity={Number.isInteger(quantity) && quantity > 0 ? quantity : 1}
    />
  );
}
