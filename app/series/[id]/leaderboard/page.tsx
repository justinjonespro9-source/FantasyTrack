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

function rankPodiumClass(rank: number) {
  if (rank === 1) return "text-ft-gold-bright";
  if (rank === 2) return "text-neutral-200";
  if (rank === 3) return "text-amber-200/90";
  return "text-neutral-400";
}

export default async function SeriesLeaderboardPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  const currentUserId = session?.user?.id ?? null;
  const access = await canUserAccessSeriesById({
    seriesId: params.id,
    userId: currentUserId,
    isAdmin: Boolean(session?.user?.isAdmin),
  });
  if (!access.exists || !access.canAccess) {
    notFound();
  }

  const series = await prisma.series.findUnique({
    where: {
      id: params.id,
    },
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

  const myIndex =
    currentUserId != null ? entries.findIndex((e) => e.userId === currentUserId) : -1;
  const myRow = myIndex >= 0 ? entries[myIndex] : null;

  return (
    <div className="space-y-6">
      {showSeriesBanner && seriesStatusParam ? (
        <SeriesStatusBanner
          status={seriesStatusParam as "joined" | "alreadyMember"}
          seriesName={searchParams.seriesName}
        />
      ) : null}

      <section className="overflow-hidden rounded-ft-lg border border-white/[0.08] bg-gradient-to-b from-ft-charcoal/40 via-black/50 to-black/80 shadow-ft-card">
        <div className="relative border-b border-white/[0.06] px-5 py-6 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-0 bg-ft-radial-gold opacity-[0.3]" aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="ft-label text-ft-gold/85">Series standings</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
                {series.name}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Ranked by net (balance − total granted). Use the filter to focus on eligible players
                only.
              </p>
              {myRow ? (
                <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-ft border border-ft-gold/25 bg-ft-gold/[0.08] px-4 py-2.5 shadow-inner">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ft-gold/90">
                    Your position
                  </span>
                  <span className="text-lg font-bold tabular-nums text-neutral-50">#{myRow.rank}</span>
                  <span className="h-4 w-px bg-white/15" aria-hidden />
                  <span className="text-sm text-neutral-400">
                    Net{" "}
                    <span className="font-semibold text-neutral-200">{formatCoins(myRow.net)}</span>
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:max-w-sm lg:items-end">
              <p className="ft-label text-neutral-500 lg:text-right">Filter</p>
              <div
                className="flex w-full flex-wrap gap-1 rounded-ft-lg border border-white/[0.1] bg-black/55 p-1.5 shadow-inner backdrop-blur-sm"
                role="tablist"
                aria-label="Entry filter"
              >
                <Link
                  href={`/series/${series.id}/leaderboard`}
                  className={
                    "min-h-[2.5rem] flex-1 rounded-ft px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition duration-ft sm:flex-none sm:px-5 " +
                    (!eligibleOnly
                      ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                      : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200")
                  }
                >
                  All
                </Link>
                <Link
                  href={`/series/${series.id}/leaderboard?eligible=1`}
                  className={
                    "min-h-[2.5rem] flex-1 rounded-ft px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition duration-ft sm:flex-none sm:px-5 " +
                    (eligibleOnly
                      ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                      : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200")
                  }
                >
                  Eligible only
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-5 pt-2 sm:px-5 sm:pb-7">
          {entries.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-neutral-500">
              No leaderboard entries for this view yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-ft border border-white/[0.06] bg-black/25 shadow-inner">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-ft-charcoal/95 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 backdrop-blur-md">
                  <tr>
                    <th className="w-20 py-3.5 pl-4 pr-2 font-bold">#</th>
                    <th className="min-w-[10rem] py-3.5 pr-4 font-bold">Player</th>
                    <th className="border-l border-white/[0.06] py-3.5 pr-4 text-right font-bold">Net</th>
                    <th className="py-3.5 pr-4 text-right font-bold">Balance</th>
                    <th className="py-3.5 pr-4 text-right font-bold">Wagered</th>
                    <th className="py-3.5 pr-4 text-right font-bold">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-200">
                  {entries.map((entry) => {
                    const isMe = currentUserId != null && entry.userId === currentUserId;
                    const isPodium = entry.rank <= 3;
                    const rowClasses = [
                      "border-b border-white/[0.04] transition-colors duration-ft",
                      isMe
                        ? "bg-gradient-to-r from-ft-gold/[0.14] via-ft-gold/[0.06] to-transparent shadow-[inset_3px_0_0_0_rgba(212,175,55,0.65)]"
                        : "hover:bg-white/[0.04]",
                      !isMe && isPodium ? "bg-white/[0.02]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr key={entry.userId} className={rowClasses}>
                        <td className="py-3.5 pl-4 pr-2 align-middle">
                          <span
                            className={`inline-flex min-w-[2rem] items-center justify-center rounded-ft border border-white/[0.08] bg-black/40 px-2 py-1 text-sm font-bold tabular-nums ${rankPodiumClass(entry.rank)}`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                isMe ? "font-bold text-neutral-50" : "font-semibold text-neutral-100"
                              }
                            >
                              {entry.displayName}
                            </span>
                            {isMe ? (
                              <span className="rounded-full border border-ft-gold/50 bg-ft-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
                                You
                              </span>
                            ) : null}
                            {entry.primaryBadge ? (
                              <span className="inline-flex items-center rounded-full border border-ft-gold/30 bg-ft-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold/95">
                                {entry.primaryBadge.label}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-l border-white/[0.05] py-3.5 pr-4 text-right align-middle font-semibold tabular-nums text-neutral-100">
                          {formatCoins(entry.net)}
                        </td>
                        <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-300">
                          {formatCoins(entry.balance)}
                        </td>
                        <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-300">
                          {formatCoins(entry.totalWagered)}
                        </td>
                        <td className="py-3.5 pr-4 text-right align-middle">
                          {entry.eligible ? (
                            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                              Not eligible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
