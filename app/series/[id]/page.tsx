import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCoins, formatDateTime } from "@/lib/format";
import { getSeriesLeaderboard } from "@/lib/market";
import { resolvePrimaryBadgeForLeaderboard } from "@/lib/badges";
import { getCurrentSession } from "@/lib/session";
import { canUserAccessSeriesById } from "@/lib/series-access";

type PageProps = {
  params: {
    id: string;
  };
};

export default async function SeriesHubPage({ params }: PageProps) {
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
    where: { id: params.id },
  });

  if (!series) {
    notFound();
  }

  const now = new Date();

  const [activeContests, upcomingContests, settledContests, leaderboardRaw] = await Promise.all([
    // Active: locked / in-play contests that are not yet settled
    prisma.contest.findMany({
      where: {
        seriesId: series.id,
        archivedAt: null,
        status: ContestStatus.LOCKED,
        settledAt: null,
      },
      orderBy: [{ startTime: "asc" }],
    }),
    // Upcoming: published contests that have not started yet
    prisma.contest.findMany({
      where: {
        seriesId: series.id,
        archivedAt: null,
        status: ContestStatus.PUBLISHED,
        startTime: { gt: now },
      },
      orderBy: [{ startTime: "asc" }],
    }),
    prisma.contest.findMany({
      where: {
        seriesId: series.id,
        status: ContestStatus.SETTLED,
      },
      orderBy: [{ settledAt: "desc" }],
      take: 10,
    }),
    getSeriesLeaderboard(series.id, false),
  ]);

  const leaderboardEntries = leaderboardRaw.map((entry) => ({
    ...entry,
    primaryBadge: resolvePrimaryBadgeForLeaderboard(entry),
  }));

  const hasAnyContests =
    activeContests.length > 0 || upcomingContests.length > 0 || settledContests.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Series header */}
      <section className="ft-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ft-label text-neutral-500">Series hub</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">{series.name}</h1>
            {series.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">{series.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              {("sport" in series && (series as any).sport) ? (
                <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 font-semibold uppercase tracking-wide text-neutral-100">
                  {(series as any).sport}
                </span>
              ) : null}
              {series.startDate ? (
                <span>
                  Runs from{" "}
                  <span className="text-neutral-100">
                    {formatDateTime(series.startDate as unknown as Date)}
                  </span>
                  {("endDate" in series && (series as any).endDate) ? (
                    <>
                      {" "}
                      to{" "}
                      <span className="text-neutral-100">
                        {formatDateTime((series as any).endDate as Date)}
                      </span>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-neutral-400">
            <Link
              href={`/series/${series.id}/leaderboard`}
              className="text-xs font-bold uppercase tracking-wide text-ft-gold underline underline-offset-2 hover:text-ft-gold-bright ft-focus-ring rounded-sm"
            >
              Full leaderboard →
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] lg:gap-8">
        {/* Contests column */}
        <div className="space-y-4">
          <section className="ft-surface p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Active Contests
            </h2>
            {activeContests.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No live or in-progress contests in this series right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeContests.map((contest) => (
                  <Link
                    key={contest.id}
                    href={`/contest/${contest.id}`}
                    className="block rounded-ft-lg border border-white/[0.06] bg-black/35 p-3 transition duration-ft hover:border-ft-gold/28 hover:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ft-gold sm:text-base">
                          {contest.title}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400 sm:text-[13px]">
                          {formatDateTime(contest.startTime)}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {contest.status === ContestStatus.LOCKED ? "Live / Locked" : "Opens Soon"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="ft-surface p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Upcoming Contests
            </h2>
            {upcomingContests.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No upcoming contests scheduled in this series yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcomingContests.map((contest) => (
                  <Link
                    key={contest.id}
                    href={`/contest/${contest.id}`}
                    className="block rounded-ft-lg border border-white/[0.06] bg-black/35 p-3 transition duration-ft hover:border-ft-gold/28 hover:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-50 sm:text-base">
                          {contest.title}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400 sm:text-[13px]">
                          Starts {formatDateTime(contest.startTime)}
                        </p>
                      </div>
                      <span className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-200">
                        Upcoming
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="ft-surface p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Settled Contests
            </h2>
            {settledContests.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No settled contests in this series yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {settledContests.map((contest) => (
                  <Link
                    key={contest.id}
                    href={`/contest/${contest.id}`}
                    className="block rounded-ft-lg border border-white/[0.06] bg-black/35 p-3 transition duration-ft hover:border-ft-gold/28 hover:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-50 sm:text-base">
                          {contest.title}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400 sm:text-[13px]">
                          Settled{" "}
                          {contest.settledAt
                            ? formatDateTime(contest.settledAt)
                            : formatDateTime(contest.startTime)}
                        </p>
                      </div>
                      <span className="rounded-full border border-ft-gold/35 bg-ft-gold/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ft-gold">
                        Settled
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Leaderboard column */}
        <section className="ft-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                Series Leaderboard
              </h2>
              <p className="text-xs text-neutral-400">Ranked by net (balance - total granted).</p>
            </div>
            <Link
              href={`/series/${series.id}/leaderboard`}
              className="text-xs font-bold uppercase tracking-wide text-ft-gold underline underline-offset-2 hover:text-ft-gold-bright ft-focus-ring rounded-sm"
            >
              Open full view →
            </Link>
          </div>

          {leaderboardEntries.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No leaderboard entries for this series yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="py-2 pr-2">Rank</th>
                    <th className="py-2 pr-2">Display Name</th>
                    <th className="py-2 pr-2">Net</th>
                    <th className="py-2 pr-2">Total Wagered</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-100">
                  {leaderboardEntries.slice(0, 15).map((entry) => (
                    <tr
                      key={entry.userId}
                      className="border-b border-white/[0.05] transition hover:bg-white/[0.03]"
                    >
                      <td className="py-1.5 pr-2">{entry.rank}</td>
                      <td className="py-1.5 pr-2">
                        <span className="font-medium text-neutral-50">{entry.displayName}</span>{" "}
                        {entry.primaryBadge ? (
                          <span className="ml-1 inline-flex items-center rounded-full border border-ft-gold/35 bg-ft-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ft-gold">
                            {entry.primaryBadge.label}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2">{formatCoins(entry.net)}</td>
                      <td className="py-1.5 pr-2">{formatCoins(entry.totalWagered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {!hasAnyContests && leaderboardEntries.length === 0 ? (
        <p className="text-sm text-neutral-500">
          This series doesn&apos;t have contests or leaderboard entries yet. Check back later.
        </p>
      ) : null}
    </div>
  );
}

