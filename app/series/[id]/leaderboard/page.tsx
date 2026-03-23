import Link from "next/link";
import { notFound } from "next/navigation";
import { SeriesStatusBanner } from "@/components/series-status-banner";
import { formatCoins } from "@/lib/format";
import { getSeriesLeaderboard } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { resolvePrimaryBadgeForLeaderboard } from "@/lib/badges";
import { getCurrentSession } from "@/lib/session";
import { canUserAccessSeriesById } from "@/lib/series-access";

type PageProps = {
  params: {
    id: string;
  };
  searchParams: {
    eligible?: string;
    seriesStatus?: string;
    seriesName?: string;
  };
};

export default async function SeriesLeaderboardPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  const access = await canUserAccessSeriesById({
    seriesId: params.id,
    userId: session?.user?.id ?? null,
    isAdmin: Boolean(session?.user?.isAdmin),
  });
  if (!access.exists || !access.canAccess) {
    notFound();
  }

  const series = await prisma.series.findUnique({
    where: {
      id: params.id
    }
  });

  if (!series) {
    notFound();
  }

  const eligibleOnly = searchParams.eligible === "1";
  const entriesRaw = await getSeriesLeaderboard(series.id, eligibleOnly);
  const entries = entriesRaw.map((entry) => ({
    ...entry,
    primaryBadge: resolvePrimaryBadgeForLeaderboard(entry),
  }));

  const seriesStatusParam = searchParams.seriesStatus;
  const showSeriesBanner =
    seriesStatusParam === "joined" || seriesStatusParam === "alreadyMember";

  return (
    <div className="space-y-4">
      {showSeriesBanner && seriesStatusParam ? (
        <SeriesStatusBanner
          status={seriesStatusParam as "joined" | "alreadyMember"}
          seriesName={searchParams.seriesName}
        />
      ) : null}

      <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-50">{series.name} Leaderboard</h1>
          <p className="text-sm text-neutral-400">Ranked by net (balance - total granted)</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/series/${series.id}/leaderboard`}
            className={
              eligibleOnly
                ? "text-neutral-300 underline"
                : "font-semibold text-amber-200/80 underline"
            }
          >
            All
          </Link>
          <span className="text-neutral-500">|</span>
          <Link
            href={`/series/${series.id}/leaderboard?eligible=1`}
            className={
              eligibleOnly
                ? "font-semibold text-amber-200/80 underline"
                : "text-neutral-300 underline"
            }
          >
            Eligible only
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400">No leaderboard entries for this view yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-2">Rank</th>
                <th className="py-2">Display Name</th>
                <th className="py-2">Net</th>
                <th className="py-2">Balance</th>
                <th className="py-2">Total Wagered (Series)</th>
                <th className="py-2">Eligibility</th>
              </tr>
            </thead>
            <tbody className="text-neutral-100">
              {entries.map((entry) => (
                <tr key={entry.userId} className="border-b border-neutral-800/80 hover:bg-neutral-900/80">
                  <td className="py-2">{entry.rank}</td>
                  <td className="py-2">
                    <span className="font-medium text-neutral-50">{entry.displayName}</span>{" "}
                    {entry.primaryBadge ? (
                      <span className="ml-1 inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                        {entry.primaryBadge.label}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">{formatCoins(entry.net)}</td>
                  <td className="py-2">{formatCoins(entry.balance)}</td>
                  <td className="py-2">{formatCoins(entry.totalWagered)}</td>
                  <td className="py-2">
                    {entry.eligible ? (
                      <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                        Eligible
                      </span>
                    ) : (
                      <span className="rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-400">
                        Not eligible
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </div>
  );
}
