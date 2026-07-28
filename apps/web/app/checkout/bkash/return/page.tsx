import type { Metadata } from "next";
import { BkashReturn } from "../../../../components/BkashReturn";

export const metadata: Metadata = { title: "Confirming your bKash payment" };

export default function BkashReturnPage() {
  return <BkashReturn />;
}
