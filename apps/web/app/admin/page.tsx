import type { Metadata } from "next";
import { AdminConsole } from "../../components/AdminConsole";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminPage() {
  return <AdminConsole />;
}
