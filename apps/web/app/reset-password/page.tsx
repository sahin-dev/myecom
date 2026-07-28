import type { Metadata } from "next";
import { ResetPassword } from "../../components/ResetPassword";

export const metadata: Metadata = { title: "Reset your password" };

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
