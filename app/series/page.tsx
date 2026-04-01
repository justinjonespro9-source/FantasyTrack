import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SeriesIndexPage() {
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;
  const isAdmin = Boolean(session?.user?.isAdmin);

  const activeSeries = await prisma.series.findMany({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
    take: 20,
  });

  const fallbackSeries =
    activeSeries.length > 0
      ? []
      : await prisma.series.findMany({
          orderBy: { startDate: "desc" },
          take: 10,
        });

  const seriesList = activeSeries.length > 0 ? activeSeries : fallbackSeries;

  const memberSeriesIds = userId
    ? new Set(
        (
          await prisma.seriesMembership.findMany({
            where: { userId },
            select: { seriesId: true },
          })
        ).map((m) => m.seriesId)
      )
    : new Set<string>();

  const visibleSeriesList = seriesList.filter(
    (s) => isAdmin || !s.isPrivate || memberSeriesIds.has(s.id)
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page header */}
      <section className="ft-surface p-5 sm:p-6">
        <p className="ft-label text-neutral-500">Browse</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">Series</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
          Series are competition hubs. Each one contains contests and a series leaderboard—browse
          below or join a private series with an invite code.
        </p>
      </section>

      {/* Join-by-code CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-ft-lg border border-white/[0.08] bg-black/35 px-4 py-4 shadow-inner sm:px-5">
        <p className="text-sm text-neutral-400">Have an invite code?</p>
        <Link
          href="/series/join"
          className="rounded-full bg-ft-cta px-5 py-2 text-sm font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110 ft-focus-ring"
        >
          Join a series
        </Link>
      </div>

      {/* Series cards */}
      {visibleSeriesList.length === 0 ? (
        <div className="ft-surface p-8 text-center">
          <p className="text-sm text-neutral-500">
            No series yet. Check back later or join a private series with an invite code.
          </p>
          <Link
            href="/series/join"
            className="mt-4 inline-block text-sm font-bold text-ft-gold underline underline-offset-2 hover:text-ft-gold-bright ft-focus-ring rounded-sm"
          >
            Join a series
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSeriesList.map((series) => (
            <Link
              key={series.id}
              href={`/series/${series.id}`}
              className="group block ft-surface-interactive p-5 transition duration-ft"
            >
              <h2 className="font-bold text-neutral-50">{series.name}</h2>
              {series.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                  {series.description}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-neutral-600">
                {series.startDate && series.endDate
                  ? `${formatDateTime(series.startDate)} – ${formatDateTime(series.endDate)}`
                  : "Ongoing"}
              </p>
              <span className="mt-3 inline-block text-xs font-semibold text-ft-gold/90 transition group-hover:text-ft-gold">
                View series →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
