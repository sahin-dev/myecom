import { ProductDetails } from "../../../components/ProductDetails";

export default function ProductPage({ params }: { params: { slug: string } }) {
  return <ProductDetails slug={params.slug} />;
}
