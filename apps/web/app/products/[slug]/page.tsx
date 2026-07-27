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

export async function generateMetadata({
  params
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return productForPage(params.slug)
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
}: {
  params: { slug: string };
  searchParams: { variant?: string; quantity?: string };
}) {
  const product = await productForPage(params.slug).catch(() => null);
  if (!product) notFound();
  const catalog = await fetchCatalog().catch(() => fallbackCatalog);
  const quantity = Number(searchParams.quantity);

  return (
    <ProductDetails
      slug={params.slug}
      initialProduct={product}
      initialCatalog={catalog}
      initialVariantId={searchParams.variant}
      initialQuantity={Number.isInteger(quantity) && quantity > 0 ? quantity : 1}
    />
  );
}
