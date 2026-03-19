import { ContestStatus } from "@prisma/client";
import Link from "next/link";
import { ClientOnly } from "@/components/client-only";
import { DashboardOnboardingCard } from "@/components/dashboard-onboarding-card";
import { SeriesStatusBanner } from "@/components/series-status-banner";
import { formatCoins, formatDateTime } from "@/lib/format";
import { autoLockContests, getGlobalLeaderboard, getSeriesLeaderboard } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { resolvePrimaryBadgeForLeaderboard } from "@/lib/badges";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardPageProps = {
  searchParams?: { seriesStatus?: string; seriesName?: string };
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await autoLockContests();
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;

  const activeSeries = await prisma.series.findMany({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
    take: 3,
  });

  const fallbackSeries =
    activeSeries.length > 0
      ? []
      : await prisma.series.findMany({
          orderBy: { startDate: "desc" },
          take: 1,
        });

  const seriesToShow = activeSeries.length > 0 ? activeSeries : fallbackSeries;

  if (seriesToShow.length === 0) {
    return <p className="rounded border border-track-200 bg-white p-4">No series yet.</p>;
  }

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

  const [globalLeaderboardRows, globalShoutouts] = await Promise.all([
    getGlobalLeaderboard(false),
    prisma.shoutout.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { contest: { select: { title: true } } },
    }),
  ]);

  const globalTop10 = globalLeaderboardRows.slice(0, 10).map((row) => ({
    ...row,
    primaryBadge: resolvePrimaryBadgeForLeaderboard(row),
  }));

  const userSeries = userId
    ? await prisma.seriesMembership.findMany({
        where: { userId },
        include: {
          series: { select: { id: true, name: true, description: true, inviteCode: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // For the dashboard Series module, avoid duplicating joined series in the Public Series preview.
  const userSeriesIds = new Set(userSeries.map((m) => m.series.id));
  const publicSeriesForPanel = seriesToShow.filter((s) => !userSeriesIds.has(s.id));

  const now = new Date();

  const seriesDashboards = await Promise.all(
    seriesToShow.map(async (series) => {
      const [activeContests, contestsForSeries, leaderboardRows, shoutouts, settledContests, yesterdayResults] =
        await Promise.all([
          prisma.contest.findMany({
            where: {
              seriesId: series.id,
              archivedAt: null,
              OR: [
                { status: ContestStatus.PUBLISHED, startTime: { gt: now } },
                { status: ContestStatus.LOCKED, settledAt: null },
              ],
            },
            orderBy: [{ startTime: "asc" }],
          }),

          prisma.contest.findMany({
            where: {
              seriesId: series.id,
              status: { in: [ContestStatus.PUBLISHED, ContestStatus.LOCKED, ContestStatus.SETTLED] },
            },
            orderBy: { startTime: "asc" },
          }),

          getSeriesLeaderboard(series.id, false),

          prisma.shoutout.findMany({
            where: { seriesId: series.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { contest: { select: { title: true } } },
          }),

          prisma.contest.findMany({
            where: { seriesId: series.id, status: ContestStatus.SETTLED },
            orderBy: { settledAt: "desc" },
          }),

          prisma.contest.findMany({
            where: {
              seriesId: series.id,
              status: ContestStatus.SETTLED,
              settledAt: { gte: yesterdayStart, lt: yesterdayEnd },
            },
            orderBy: { settledAt: "desc" },
            include: {
              lanes: {
                where: { finalRank: { lte: 3 } },
                orderBy: { finalRank: "asc" },
              },
            },
          }),
        ]);

      return { series, activeContests, leaderboardRows, shoutouts, settledContests, yesterdayResults };
    })
  );

  const seriesStatusParam = searchParams?.seriesStatus;
  const showSeriesBanner =
    seriesStatusParam === "joined" || seriesStatusParam === "alreadyMember";

  const allActiveContests = seriesDashboards.flatMap((d) => d.activeContests);
  allActiveContests.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const openContestsCount = allActiveContests.length;
  const settledTodayCount = seriesDashboards.reduce(
    (sum, d) => sum + d.yesterdayResults.length,
    0
  );

  const hasHistory = globalTop10.length > 0 || userSeries.length > 0;

  const contestSeriesById: Record<string, string> = {};
  seriesDashboards.forEach(({ series, activeContests }) => {
    activeContests.forEach((c: any) => {
      contestSeriesById[c.id] = series.name;
    });
  });

  return (
    <div className="space-y-5">
      {showSeriesBanner && seriesStatusParam ? (
        <SeriesStatusBanner
          status={seriesStatusParam as "joined" | "alreadyMember"}
          seriesName={searchParams?.seriesName}
        />
      ) : null}

      <ClientOnly>
        <DashboardOnboardingCard hasHistory={hasHistory} />
      </ClientOnly>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              My Track
            </p>
            <p className="text-xs text-neutral-300">
              Join a live contest, enter a series, and track your results.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-neutral-400">Live entries</p>
              <p className="font-semibold text-neutral-50">—</p>
            </div>
            <div>
              <p className="text-neutral-400">Open contests</p>
              <p className="font-semibold text-neutral-50">
                {openContestsCount ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">Recently settled</p>
              <p className="font-semibold text-neutral-50">
                {settledTodayCount ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">ROI</p>
              <p className="font-semibold text-neutral-50">Coming soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Top row: Active Contests (left) + Series panel (right) */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Active Contests — primary focus */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-neutral-50">Active Contests</h1>
          </div>
          {allActiveContests.length === 0 ? (
            <div className="space-y-2 text-sm text-neutral-300">
              <p>No active contests right now.</p>
              <p className="text-xs text-neutral-400">
                When contests are open, they&apos;ll appear here. You can still join a
                series now so you&apos;re ready when new contests post.
              </p>
              <Link
                href="/series/join"
                className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300"
              >
                Join a Series
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allActiveContests.map((c) => (
                <Link
                  key={c.id}
                  href={`/contest/${c.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 hover:border-amber-400/60 hover:bg-neutral-900/80 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-amber-300 sm:text-base">
                        {c.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400 sm:text-[13px]">
                        {contestSeriesById[c.id] ? (
                          <>
                            <span className="rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
                              {contestSeriesById[c.id]}
                            </span>
                            <span className="mx-1 text-neutral-600">·</span>
                          </>
                        ) : null}
                        Starts{" "}
                        <ClientOnly>
                          <span>{formatDateTime(c.startTime)}</span>
                        </ClientOnly>{" "}
                        · Status: {c.status}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-400/70 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                      {c.status === ContestStatus.PUBLISHED ? "Open" : c.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Series panel */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
              Series
            </h2>
          </div>

          {/* Your Series / Private series */}
          {!userId ? (
            <p className="text-sm text-neutral-400">
              Sign in to see and join series you&apos;re competing in.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Your Series
                </p>
                {userSeries.length === 0 ? (
                  <div className="mt-1 space-y-2 text-sm">
                    <p className="text-neutral-300">
                      Join a private series with an invite code to compete on its leaderboard.
                    </p>
                    <p className="text-xs text-neutral-400">
                      Series track your performance across multiple contests and unlock more
                      competitive stats.
                    </p>
                    <Link
                      href="/series/join"
                      className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300"
                    >
                      Join a Series
                    </Link>
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    {userSeries.slice(0, 3).map((m) => (
                      <Link
                        key={m.id}
                        href={`/series/${m.series.id}`}
                        className="block rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 hover:border-amber-400/60 hover:bg-neutral-900/80 transition-colors"
                      >
                        <p className="font-semibold text-neutral-50">{m.series.name}</p>
                        {m.series.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-300">
                            {m.series.description}
                          </p>
                        ) : null}
                        {m.series.inviteCode ? (
                          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                            Code: {m.series.inviteCode}
                          </p>
                        ) : null}
                        <span className="mt-2 inline-block text-xs text-amber-200/80 hover:text-amber-200">
                          View series →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Public Series */}
              {publicSeriesForPanel.length > 0 && (
                <div className="border-t border-neutral-800 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Public Series
                  </p>
                  <div className="space-y-1.5">
                    {publicSeriesForPanel.slice(0, 3).map((s) => (
                      <Link
                        key={s.id}
                        href={`/series/${s.id}`}
                        className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950/80 px-2.5 py-1.5 text-xs text-neutral-200 hover:border-amber-400/60 hover:bg-neutral-900/80 transition-colors"
                      >
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="text-[10px] text-neutral-400">View series</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* GLOBAL HUB (always visible) */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-50">Overall Leaderboard (Top 10)</h2>
            <Link href="/leaderboard" className="text-sm text-amber-200/80 underline">
              Full leaderboard
            </Link>
          </div>

          {globalTop10.length === 0 ? (
            <p className="text-sm text-neutral-400">No entries yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="py-1">Rank</th>
                  <th className="py-1">Name</th>
                  <th className="py-1">Skill</th>
                  <th className="py-1">Wagered</th>
                </tr>
              </thead>
              <tbody>
                {globalTop10.map((row) => (
                  <tr
                    key={row.userId}
                    className="border-t border-neutral-800/70 text-neutral-100 hover:bg-neutral-900/70"
                  >
                    <td className="py-1">{row.rank}</td>
                    <td className="py-1">
                      <span className="font-medium text-neutral-50">{row.displayName}</span>{" "}
                      {row.primaryBadge ? (
                        <span className="ml-1 inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                          {row.primaryBadge.label}
                        </span>
                      ) : null}
                      {row.eligible ? (
                        <span className="ml-1 text-xs font-semibold text-emerald-300">Eligible</span>
                      ) : null}
                    </td>
                    <td className="py-1 tabular-nums">{row.skillScore.toFixed(1)}</td>
                    <td className="py-1">{formatCoins(row.totalWagered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <h2 className="mb-2 text-base font-semibold text-neutral-50">Commish Notes</h2>

          {globalShoutouts.length === 0 ? (
            <p className="text-sm text-neutral-400">No notes posted.</p>
          ) : (
            <ul className="space-y-2 text-sm text-neutral-100">
              {globalShoutouts.map((s) => (
                <li key={s.id} className="rounded border border-neutral-800 bg-neutral-950/80 p-2">
                  <p>{s.message}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    <ClientOnly>
                      <span>{formatDateTime(s.createdAt)}</span>
                    </ClientOnly>
                    {s.contest ? ` · ${s.contest.title}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* SERIES SECTIONS (drill-down) */}
      {seriesDashboards.map(({ series, activeContests, leaderboardRows, shoutouts, settledContests, yesterdayResults }) => {
        const top10 = leaderboardRows.slice(0, 10);

        return (
          <details
            key={series.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4"
            open={seriesDashboards.length === 1}
          >
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold text-neutral-50">{series.name}</h1>
                  <p className="mt-1 text-sm text-neutral-400">
                    <ClientOnly>
                      <span>
                        {formatDateTime(series.startDate)} - {formatDateTime(series.endDate)}
                      </span>
                    </ClientOnly>
                  </p>
                  {series.prizesText ? (
                    <p className="mt-2 text-sm text-neutral-300">{series.prizesText}</p>
                  ) : null}
                </div>

                <span className="rounded bg-neutral-950 px-2 py-1 text-xs font-semibold text-neutral-200">
                  View / Close
                </span>
              </div>
            </summary>

            <div className="mt-4 space-y-6">
              <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-50">Active contests</h2>
                </div>

                {activeContests.length === 0 ? (
                  <p className="text-sm text-neutral-400">
                    No active contests in this series right now. New contests for this
                    series will show up here as soon as they open.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeContests.map((c) => (
                      <Link
                        key={c.id}
                        href={`/contest/${c.id}`}
                        className="block rounded border border-neutral-800 bg-neutral-950/80 p-4 hover:bg-neutral-900/80"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-amber-300">{c.title}</p>
                            <p className="text-sm text-neutral-400">
                              Starts{" "}
                              <ClientOnly>
                                <span>{formatDateTime(c.startTime)}</span>
                              </ClientOnly>{" "}
                              · Status: {c.status}
                            </p>
                          </div>

                          <span className="rounded bg-neutral-900 px-2 py-1 text-xs font-semibold text-amber-200">
                            {c.status === ContestStatus.PUBLISHED ? "Open" : c.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-50">
                    Settled contests ({settledContests.length})
                  </summary>

                  {settledContests.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-400">No settled contests yet.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {settledContests.map((c) => (
                        <Link
                          key={c.id}
                          href={`/contest/${c.id}`}
                          className="block rounded border border-neutral-800 bg-neutral-950/80 p-4 hover:bg-neutral-900/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-neutral-50">{c.title}</p>
                              <p className="text-sm text-neutral-400">
                                Settled{" "}
                                <ClientOnly>
                                  <span>{formatDateTime(c.settledAt ?? c.startTime)}</span>
                                </ClientOnly>
                              </p>
                            </div>
                            <span className="rounded bg-neutral-900 px-2 py-1 text-xs font-semibold text-neutral-200">
                              View
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </details>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-50">Leaderboard (Top 10)</h2>
                    <Link
                      href={`/series/${series.id}/leaderboard`}
                      className="text-sm text-amber-200/80 underline"
                    >
                      Full leaderboard
                    </Link>
                  </div>

                  {top10.length === 0 ? (
                    <p className="text-sm text-neutral-400">No entries yet.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="text-neutral-400">
                        <tr>
                          <th className="py-1">Rank</th>
                          <th className="py-1">Name</th>
                          <th className="py-1">Net</th>
                          <th className="py-1">Wagered</th>
                        </tr>
                      </thead>
                      <tbody className="text-neutral-100">
                        {top10.map((row) => (
                          <tr
                            key={row.userId}
                            className="border-t border-neutral-800/70 hover:bg-neutral-900/80"
                          >
                            <td className="py-1 text-neutral-100">{row.rank}</td>
                            <td className="py-1">
                              <span className="font-medium text-neutral-50">
                                {row.displayName}
                              </span>{" "}
                              {row.eligible ? (
                                <span className="text-xs font-semibold text-emerald-300">
                                  Eligible
                                </span>
                              ) : null}
                            </td>
                            <td className="py-1">{formatCoins(row.net)}</td>
                            <td className="py-1">{formatCoins(row.totalWagered)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
                  <h2 className="mb-2 text-base font-semibold text-neutral-50">Commish Notes</h2>
                  {shoutouts.length === 0 ? (
                    <p className="text-sm text-neutral-400">No notes posted.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-neutral-100">
                      {shoutouts.map((s) => (
                        <li
                          key={s.id}
                          className="rounded border border-neutral-800 bg-neutral-950/80 p-2"
                        >
                          <p>{s.message}</p>
                          <p className="mt-1 text-xs text-neutral-400">
                            <ClientOnly>
                              <span>{formatDateTime(s.createdAt)}</span>
                            </ClientOnly>
                            {s.contest ? ` · ${s.contest.title}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
                <h2 className="mb-2 text-base font-semibold text-neutral-50">Yesterday results</h2>
                {yesterdayResults.length === 0 ? (
                  <p className="text-sm text-neutral-400">No settled contests yesterday.</p>
                ) : (
                  <div className="space-y-3">
                    {yesterdayResults.map((contest) => (
                      <div
                        key={contest.id}
                        className="rounded border border-neutral-800 bg-neutral-950/80 p-4"
                      >
                        <p className="font-semibold text-neutral-50">{contest.title}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          Settled{" "}
                          <ClientOnly>
                            <span>{formatDateTime(contest.settledAt ?? contest.startTime)}</span>
                          </ClientOnly>
                        </p>

                        <ul className="mt-2 space-y-1 text-sm text-neutral-200">
                          {contest.lanes.map((lane) => (
                            <li key={lane.id}>
                              #{lane.finalRank} {lane.name}
                              {lane.fantasyPoints != null ? ` (${lane.fantasyPoints} pts)` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </details>
        );
      })}
    </div>
  );
}

