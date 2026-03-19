import Link from "next/link";
import ResetPasswordForm from "@/components/auth/reset-password-form";

type Props = { searchParams?: { token?: string } };

export default function ResetPasswordPage({ searchParams }: Props) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";

  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border border-track-200 bg-white p-6 shadow-sm">
      <h1 className="text-center">Set new password</h1>
      <p className="text-center text-sm text-track-600">
        Enter your new password below. Use the link from your email; links expire after 1 hour.
      </p>
      <ResetPasswordForm token={token} />
      <p className="text-center text-sm text-track-600">
        <Link href="/auth/login" className="text-track-800 underline">
          Back to log in
        </Link>
      </p>
    </section>
  );
}
