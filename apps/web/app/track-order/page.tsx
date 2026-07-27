import type { Metadata } from "next";
import { TrackOrder } from "../../components/TrackOrder";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackOrderPage() {
  return <TrackOrder />;
}
