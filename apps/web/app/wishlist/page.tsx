import type { Metadata } from "next";
import { WishlistPage } from "../../components/WishlistPage";

export const metadata: Metadata = { title: "Saved products" };

export default function WishlistRoute() {
  return <WishlistPage />;
}
