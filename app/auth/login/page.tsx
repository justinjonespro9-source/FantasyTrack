import Link from "next/link";
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border border-track-200 bg-white p-6 shadow-sm">
      <h1 className="text-center">Log in</h1>
      <LoginForm />
      <p className="text-center text-sm text-track-600">
        Need an account? <Link href="/auth/signup" className="text-track-800 underline">Sign up</Link>
      </p>
      <p className="text-center text-xs text-track-500">
        By continuing, you agree to the{" "}
        <Link href="/terms" className="text-track-700 underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-track-700 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </section>
  );
}
