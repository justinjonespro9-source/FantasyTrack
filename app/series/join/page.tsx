import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import SeriesJoinForm from "@/components/series-join-form";

export const dynamic = "force-dynamic";

export default async function SeriesJoinPage() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
            Private series
          </p>
          <h1 className="text-xl font-semibold text-neutral-50">Join a Series</h1>
          <p className="text-sm text-neutral-300">
            Enter an invite code from your league organizer to join their private FantasyTrack
            Series. You&apos;ll appear on that group&apos;s leaderboards and dashboards.
          </p>
        </div>

        <div className="mt-4 max-w-md">
          <SeriesJoinForm />
        </div>
      </section>
    </div>
  );
}

