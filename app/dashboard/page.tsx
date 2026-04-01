import { ContestStatus, ShoutoutScope } from "@prisma/client";
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

/** Presentation-only: contest status chip on dashboard cards (same labels as before). */
function dashboardContestStatusPillClass(status: ContestStatus) {
  const isOpen = status === ContestStatus.PUBLISHED;
  const isLocked = status === ContestStatus.LOCKED;
  return [
    "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
    isOpen ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "",
    isLocked ? "border-ft-gold/40 bg-ft-gold/12 text-ft-gold" : "",
    !isOpen && !isLocked ? "border-white/10 bg-white/[0.06] text-neutral-400" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function dashboardContestStatusLabel(status: ContestStatus) {
  return status === ContestStatus.PUBLISHED ? "Open" : status;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await autoLockContests();
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;

  const activeSeries = await prisma.series.findMany({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
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
    return (
      <p className="ft-surface rounded-ft-lg p-6 text-sm text-neutral-400">No series yet.</p>
    );
  }

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

  const [globalLeaderboardRows, globalShoutouts] = await Promise.all([
    getGlobalLeaderboard(false),
    prisma.shoutout.findMany({
      where: { scope: ShoutoutScope.GLOBAL },
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
          series: { select: { id: true, name: true, description: true, inviteCode: true, isPrivate: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // For the dashboard Series module, avoid duplicating joined series in the Public Series preview.
  const userSeriesIds = new Set(userSeries.map((m) => m.series.id));
  const isAdmin = Boolean(session?.user?.isAdmin);
  /** Private-series contests only for members + admins; omit from discovery for everyone else. */
  const visibleSeriesForDashboard = seriesToShow.filter(
    (s) => isAdmin || !s.isPrivate || userSeriesIds.has(s.id)
  );
  const availableSeriesForPanel = seriesToShow.filter((s) => !userSeriesIds.has(s.id));
  const publicSeriesForPanel = availableSeriesForPanel.filter((s) => !Boolean((s as any).isPrivate));
  const privateSeriesForPanel = availableSeriesForPanel.filter((s) => Boolean((s as any).isPrivate));

  const now = new Date();

  const seriesDashboards = await Promise.all(
    visibleSeriesForDashboard.map(async (series) => {
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
            where: { scope: ShoutoutScope.SERIES, seriesId: series.id },
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
    <div className="space-y-8 md:space-y-10">
      {showSeriesBanner && seriesStatusParam ? (
        <SeriesStatusBanner
          status={seriesStatusParam as "joined" | "alreadyMember"}
          seriesName={searchParams?.seriesName}
        />
      ) : null}

      <ClientOnly>
        <DashboardOnboardingCard hasHistory={hasHistory} />
      </ClientOnly>

      <section className="relative overflow-hidden rounded-ft-lg border border-white/[0.08] bg-gradient-to-br from-ft-charcoal/95 via-black/80 to-black/95 p-5 shadow-ft-card sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-ft-gold/[0.07] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-lg">
            <p className="ft-label text-ft-gold/80">Command center</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
              My track
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Live contests first — then series, standings, and commish notes below.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:flex lg:flex-wrap lg:justify-end">
            <div className="rounded-ft border border-white/[0.06] bg-black/40 px-4 py-3 text-center shadow-inner sm:min-w-[7rem] sm:text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Live entries</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-neutral-400">—</p>
            </div>
            <div className="rounded-ft border border-ft-gold/20 bg-ft-gold/[0.06] px-4 py-3 text-center shadow-inner sm:min-w-[7rem] sm:text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Open contests</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ft-gold">{openContestsCount ?? "—"}</p>
            </div>
            <div className="rounded-ft border border-white/[0.06] bg-black/40 px-4 py-3 text-center shadow-inner sm:min-w-[7rem] sm:text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Recently settled</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-neutral-100">{settledTodayCount ?? "—"}</p>
            </div>
            <div className="rounded-ft border border-white/[0.06] bg-black/40 px-4 py-3 text-center shadow-inner sm:min-w-[7rem] sm:text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">ROI</p>
              <p className="mt-1 text-sm font-semibold text-neutral-500">Soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Primary: active contests · Secondary: series */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-8">
        <section className="relative overflow-hidden rounded-ft-lg border border-ft-gold/20 bg-gradient-to-b from-ft-gold/[0.06] via-black/40 to-black/60 p-5 shadow-ft-card sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ft-gold/40 to-transparent" aria-hidden />
          <div className="relative mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ft-label text-ft-gold/90">Main event</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-50 sm:text-[1.65rem]">
                Active contests
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
                Open or locked — enter the board to view lines, live scoring, and your slip.
              </p>
            </div>
          </div>
          {allActiveContests.length === 0 ? (
            <div className="relative space-y-4 rounded-ft border border-white/[0.06] bg-black/35 p-5 text-sm text-neutral-400">
              <p className="text-neutral-300">No active contests right now.</p>
              <p className="text-sm leading-relaxed">
                When contests open, they&apos;ll list here first. Join a series so you&apos;re ready when
                races post.
              </p>
              <Link
                href="/series/join"
                className="inline-flex items-center justify-center rounded-full bg-ft-cta px-5 py-2.5 text-sm font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110"
              >
                Join a series
              </Link>
            </div>
          ) : (
            <div className="relative space-y-3">
              {allActiveContests.map((c) => (
                <Link
                  key={c.id}
                  href={`/contest/${c.id}`}
                  className="group block rounded-ft-lg border border-white/[0.08] bg-black/45 p-4 transition-all duration-ft hover:border-ft-gold/35 hover:bg-black/55 hover:shadow-ft-card-hover sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold leading-snug text-neutral-50 transition group-hover:text-ft-gold sm:text-lg">
                        {c.title}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 sm:text-sm">
                        {contestSeriesById[c.id] ? (
                          <>
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                              {contestSeriesById[c.id]}
                            </span>
                            <span className="text-neutral-600">·</span>
                          </>
                        ) : null}
                        <span>
                          Starts{" "}
                          <ClientOnly>
                            <span className="font-medium text-neutral-400">{formatDateTime(c.startTime)}</span>
                          </ClientOnly>
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span>{c.status}</span>
                      </p>
                    </div>
                    <span className={dashboardContestStatusPillClass(c.status)}>
                      {dashboardContestStatusLabel(c.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="ft-surface p-5 sm:p-6">
          <div className="mb-5 border-b border-white/[0.06] pb-4">
            <p className="ft-label text-neutral-500">Directory</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-neutral-50">Series</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Tracks you belong to and public discovery.
            </p>
          </div>

          {/* Your Series / Private series */}
          {!userId ? (
            <p className="text-sm text-neutral-400">
              Sign in to see and join series you&apos;re competing in.
            </p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="ft-label text-neutral-500">Your series</p>
                {userSeries.length === 0 ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="leading-relaxed text-neutral-400">
                      Join a private series with an invite code to compete on its leaderboard.
                    </p>
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Series track your performance across multiple contests and unlock more
                      competitive stats.
                    </p>
                    <Link
                      href="/series/join"
                      className="inline-flex items-center justify-center rounded-full bg-ft-cta px-4 py-2 text-sm font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110"
                    >
                      Join a series
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {userSeries.map((m) => (
                      <Link
                        key={m.id}
                        href={`/series/${m.series.id}`}
                        className="group block rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 transition-all duration-ft hover:border-ft-gold/30 hover:bg-white/[0.04]"
                      >
                        <p className="font-bold text-neutral-50">{m.series.name}</p>
                        {m.series.description ? (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                            {m.series.description}
                          </p>
                        ) : null}
                        {m.series.inviteCode ? (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                            Code {m.series.inviteCode}
                          </p>
                        ) : null}
                        <span className="mt-2 inline-block text-xs font-semibold text-ft-gold/90 transition group-hover:text-ft-gold">
                          View series →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Public Series */}
              {publicSeriesForPanel.length > 0 && (
                <div className="border-t border-white/[0.06] pt-5">
                  <p className="ft-label text-neutral-500">Public series</p>
                  <div className="mt-3 space-y-2">
                    {publicSeriesForPanel.map((s) => (
                      <Link
                        key={s.id}
                        href={`/series/${s.id}`}
                        className="flex items-center justify-between gap-2 rounded-ft border border-white/[0.06] bg-black/30 px-3 py-2.5 text-xs text-neutral-200 transition hover:border-ft-gold/25 hover:bg-white/[0.03]"
                      >
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                          Open
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Private Series */}
              {privateSeriesForPanel.length > 0 && (
                <div className="border-t border-white/[0.06] pt-5">
                  <p className="ft-label text-neutral-500">Private (invite only)</p>
                  <div className="mt-3 space-y-2">
                    {privateSeriesForPanel.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-ft border border-white/[0.06] bg-black/25 px-3 py-2.5 text-xs text-neutral-300"
                      >
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="shrink-0 rounded-full border border-ft-gold/30 bg-ft-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
                          Invite only
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/series/join"
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-ft-gold/35 bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold transition hover:border-ft-gold/60 hover:bg-ft-gold/10"
                  >
                    Join with code
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Supporting: global standings & broadcast notes */}
      <div className="space-y-3 border-t border-white/[0.06] pt-8 md:pt-10">
        <p className="ft-label px-0.5 text-neutral-500">League desk</p>
        <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="ft-surface p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-neutral-50">Overall leaderboard</h2>
                <p className="mt-1 text-xs text-neutral-500">Top skill scores across FantasyTrack.</p>
              </div>
              <Link
                href="/leaderboard"
                className="text-xs font-bold uppercase tracking-wide text-ft-gold transition hover:text-ft-gold-bright"
              >
                Full board →
              </Link>
            </div>

            {globalTop10.length === 0 ? (
              <p className="text-sm text-neutral-500">No entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead className="border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                    <tr>
                      <th className="py-2.5 pr-2">Rank</th>
                      <th className="py-2.5 pr-2">Name</th>
                      <th className="py-2.5 pr-2">Skill</th>
                      <th className="py-2.5">Wagered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalTop10.map((row) => (
                      <tr
                        key={row.userId}
                        className="border-b border-white/[0.04] text-neutral-200 transition last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="py-2.5 pr-2 tabular-nums text-neutral-400">{row.rank}</td>
                        <td className="py-2.5 pr-2">
                          <span className="font-semibold text-neutral-50">{row.displayName}</span>{" "}
                          {row.primaryBadge ? (
                            <span className="ml-1 inline-flex items-center rounded-full border border-ft-gold/35 bg-ft-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
                              {row.primaryBadge.label}
                            </span>
                          ) : null}
                          {row.eligible ? (
                            <span className="ml-1 text-xs font-semibold text-emerald-400">Eligible</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-2 tabular-nums text-neutral-300">{row.skillScore.toFixed(1)}</td>
                        <td className="py-2.5 text-neutral-300">{formatCoins(row.totalWagered)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ft-surface p-5 sm:p-6">
            <div className="mb-5 border-b border-white/[0.06] pb-4">
              <h2 className="text-lg font-bold tracking-tight text-neutral-50">Commish notes</h2>
              <p className="mt-1 text-xs text-neutral-500">Broadcast updates from the desk.</p>
            </div>

            {globalShoutouts.length === 0 ? (
              <p className="text-sm text-neutral-500">No notes posted.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {globalShoutouts.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-ft-lg border border-white/[0.06] bg-black/40 p-4 text-neutral-300"
                  >
                    <p className="leading-relaxed">{s.message}</p>
                    <p className="mt-2 text-xs text-neutral-500">
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
      </div>

      {/* Series detail — supporting drill-down */}
      <div className="space-y-3 border-t border-white/[0.06] pt-8 md:pt-10">
        <p className="ft-label px-0.5 text-neutral-500">Series breakdown</p>
        <div className="space-y-5">
          {seriesDashboards.map(({ series, activeContests, leaderboardRows, shoutouts, settledContests, yesterdayResults }) => {
            const top10 = leaderboardRows.slice(0, 10);

            return (
              <details
                key={series.id}
                className="group ft-surface overflow-hidden rounded-ft-lg open:shadow-ft-card"
                open={seriesDashboards.length === 1}
              >
                <summary className="cursor-pointer list-none px-5 py-4 transition hover:bg-white/[0.02] sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="ft-label text-neutral-500">Series</p>
                      <h3 className="mt-1 text-xl font-bold tracking-tight text-neutral-50">{series.name}</h3>
                      <p className="mt-2 text-sm text-neutral-500">
                        <ClientOnly>
                          <span>
                            {series.startDate && series.endDate
                              ? `${formatDateTime(series.startDate)} – ${formatDateTime(series.endDate)}`
                              : "Ongoing"}
                          </span>
                        </ClientOnly>
                      </p>
                      {series.prizesText ? (
                        <p className="mt-3 text-sm leading-relaxed text-neutral-400">{series.prizesText}</p>
                      ) : null}
                    </div>

                    <span className="shrink-0 rounded-full border border-white/[0.1] bg-black/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-400 group-open:border-ft-gold/30 group-open:text-ft-gold">
                      Expand
                    </span>
                  </div>
                </summary>

                <div className="space-y-5 border-t border-white/[0.06] px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
                  <section className="rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 sm:p-5">
                    <div className="mb-4 border-b border-white/[0.06] pb-3">
                      <h4 className="text-base font-bold text-neutral-50">Active contests</h4>
                      <p className="mt-1 text-xs text-neutral-500">In this series only.</p>
                    </div>

                    {activeContests.length === 0 ? (
                      <p className="text-sm leading-relaxed text-neutral-500">
                        No active contests in this series right now. New contests for this
                        series will show up here as soon as they open.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {activeContests.map((c) => (
                          <Link
                            key={c.id}
                            href={`/contest/${c.id}`}
                            className="group block rounded-ft-lg border border-white/[0.06] bg-black/40 p-4 transition hover:border-ft-gold/25 hover:bg-white/[0.03] sm:p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-base font-bold text-neutral-50 transition group-hover:text-ft-gold">
                                  {c.title}
                                </p>
                                <p className="mt-1.5 text-sm text-neutral-500">
                                  Starts{" "}
                                  <ClientOnly>
                                    <span className="font-medium text-neutral-400">{formatDateTime(c.startTime)}</span>
                                  </ClientOnly>{" "}
                                  · {c.status}
                                </p>
                              </div>

                              <span className={dashboardContestStatusPillClass(c.status)}>
                                {dashboardContestStatusLabel(c.status)}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 sm:p-5">
                    <details className="group/settled">
                      <summary className="cursor-pointer list-none text-base font-bold text-neutral-50 [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          Settled contests
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs font-bold tabular-nums text-neutral-400">
                            {settledContests.length}
                          </span>
                        </span>
                      </summary>

                      {settledContests.length === 0 ? (
                        <p className="mt-3 text-sm text-neutral-500">No settled contests yet.</p>
                      ) : (
                        <div className="mt-4 space-y-2.5">
                          {settledContests.map((c) => (
                            <Link
                              key={c.id}
                              href={`/contest/${c.id}`}
                              className="group block rounded-ft border border-white/[0.06] bg-black/40 p-4 transition hover:border-ft-gold/20 hover:bg-white/[0.03]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-bold text-neutral-50">{c.title}</p>
                                  <p className="mt-1 text-sm text-neutral-500">
                                    Settled{" "}
                                    <ClientOnly>
                                      <span>{formatDateTime(c.settledAt ?? c.startTime)}</span>
                                    </ClientOnly>
                                  </p>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wide text-ft-gold/90">
                                  View →
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </details>
                  </section>

                  <section className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                    <div className="rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 sm:p-5">
                      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] pb-3">
                        <div>
                          <h4 className="text-base font-bold text-neutral-50">Leaderboard (top 10)</h4>
                          <p className="mt-1 text-xs text-neutral-500">Net and volume in this series.</p>
                        </div>
                        <Link
                          href={`/series/${series.id}/leaderboard`}
                          className="text-xs font-bold uppercase tracking-wide text-ft-gold transition hover:text-ft-gold-bright"
                        >
                          Full board →
                        </Link>
                      </div>

                      {top10.length === 0 ? (
                        <p className="text-sm text-neutral-500">No entries yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[260px] text-left text-sm">
                            <thead className="border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
                              <tr>
                                <th className="py-2 pr-2">Rank</th>
                                <th className="py-2 pr-2">Name</th>
                                <th className="py-2 pr-2">Net</th>
                                <th className="py-2">Wagered</th>
                              </tr>
                            </thead>
                            <tbody className="text-neutral-200">
                              {top10.map((row) => (
                                <tr
                                  key={row.userId}
                                  className="border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.03]"
                                >
                                  <td className="py-2 pr-2 tabular-nums text-neutral-400">{row.rank}</td>
                                  <td className="py-2 pr-2">
                                    <span className="font-semibold text-neutral-50">
                                      {row.displayName}
                                    </span>{" "}
                                    {row.eligible ? (
                                      <span className="text-xs font-semibold text-emerald-400">
                                        Eligible
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="py-2 pr-2">{formatCoins(row.net)}</td>
                                  <td className="py-2">{formatCoins(row.totalWagered)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 sm:p-5">
                      <h4 className="mb-4 border-b border-white/[0.06] pb-3 text-base font-bold text-neutral-50">
                        Commish notes
                      </h4>
                      {shoutouts.length === 0 ? (
                        <p className="text-sm text-neutral-500">No notes posted.</p>
                      ) : (
                        <ul className="space-y-3 text-sm">
                          {shoutouts.map((s) => (
                            <li
                              key={s.id}
                              className="rounded-ft border border-white/[0.06] bg-black/40 p-3"
                            >
                              <p className="leading-relaxed text-neutral-300">{s.message}</p>
                              <p className="mt-2 text-xs text-neutral-500">
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

                  <section className="rounded-ft-lg border border-white/[0.06] bg-black/35 p-4 sm:p-5">
                    <h4 className="mb-4 text-base font-bold text-neutral-50">Yesterday results</h4>
                    {yesterdayResults.length === 0 ? (
                      <p className="text-sm text-neutral-500">No settled contests yesterday.</p>
                    ) : (
                      <div className="space-y-3">
                        {yesterdayResults.map((contest) => (
                          <div
                            key={contest.id}
                            className="rounded-ft border border-white/[0.06] bg-black/40 p-4"
                          >
                            <p className="font-bold text-neutral-50">{contest.title}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              Settled{" "}
                              <ClientOnly>
                                <span>{formatDateTime(contest.settledAt ?? contest.startTime)}</span>
                              </ClientOnly>
                            </p>

                            <ul className="mt-3 space-y-1.5 text-sm text-neutral-300">
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
      </div>
    </div>
  );
}

