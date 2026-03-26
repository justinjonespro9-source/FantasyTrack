import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

/** Lightweight landing page after X OAuth (avoids loading the full admin dashboard). */
export default async function XOAuthDonePage() {
  const session = await getCurrentSession();
  if (!session?.user?.id || !session.user.isAdmin) {
    redirect("/auth/login");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-8 text-neutral-100">
      <h1 className="text-xl font-semibold text-amber-200">X account connected</h1>
      <p className="text-sm text-neutral-300">
        OAuth completed and tokens were stored. You can open the full admin dashboard when ready.
      </p>
      <Link
        href="/admin"
        className="inline-block rounded border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
      >
        Go to admin
      </Link>
    </div>
  );
}
