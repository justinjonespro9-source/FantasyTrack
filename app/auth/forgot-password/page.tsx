import { redirect } from "next/navigation";

export default function LegacyForgotPasswordRedirectPage() {
  redirect("/forgot-password");
}
