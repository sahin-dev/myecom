import type { Metadata } from "next";
import { CheckoutPage } from "../../components/CheckoutPage";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
