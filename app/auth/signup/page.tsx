import Link from "next/link";
import SignupForm from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-lg border border-track-200 bg-white p-6 shadow-sm">
      <h1 className="text-center">Create account</h1>
      <SignupForm />
      <p className="text-center text-sm text-track-600">
        Already have an account? <Link href="/auth/login" className="text-track-800 underline">Log in</Link>
      </p>
      <p className="text-center text-xs text-track-500">
        By creating an account, you agree to the{" "}
        <Link href="/terms" className="text-track-700 underline">
          Terms of Use
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
