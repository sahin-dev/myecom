import type { Metadata } from "next";
import { ComboDealsPage } from "../../components/ComboDealsPage";

export const metadata: Metadata = { title: "Combo deals" };

export default function Page() {
  return <ComboDealsPage />;
}
