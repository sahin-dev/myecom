import type { Metadata } from "next";
import { AccountPage } from "../../components/AccountPage";

export const metadata: Metadata = { title: "Your account" };

export default function AccountRoute() {
  return <AccountPage />;
}
