import Link from "next/link";
import ResetPasswordForm from "@/components/auth/reset-password-form";

type PageProps = {
  searchParams?: { selector?: string; token?: string; email?: string };
};

export default function ResetPasswordPage({ searchParams }: PageProps) {
  const selector = (searchParams?.selector ?? "").trim();
  const token = (searchParams?.token ?? "").trim();
  const email = (searchParams?.email ?? "").toLowerCase();

  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border border-track-200 bg-white p-6 shadow-sm">
      <h1 className="text-center">Reset password</h1>
      <p className="text-center text-sm text-track-600">
        Enter a new password for your FantasyTrack account.
      </p>
      <ResetPasswordForm selector={selector} token={token} email={email} />
      <p className="text-center text-sm text-track-600">
        <Link href="/auth/login" className="text-track-800 underline">
          Back to log in
        </Link>
      </p>
    </section>
  );
}
