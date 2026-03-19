import Link from "next/link";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border border-track-200 bg-white p-6 shadow-sm">
      <h1 className="text-center">Forgot password</h1>
      <p className="text-center text-sm text-track-600">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-track-600">
        <Link href="/auth/login" className="text-track-800 underline">
          Back to log in
        </Link>
      </p>
    </section>
  );
}
