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
    <div className="space-y-6">
      {/* Page header */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-50">Series</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Series are competition hubs. Each one contains contests and a series leaderboard—browse
          below or join a private series with an invite code.
        </p>
      </section>

      {/* Join-by-code CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 px-4 py-3">
        <p className="text-sm text-neutral-300">Have an invite code?</p>
        <Link
          href="/series/join"
          className="rounded-full border border-amber-400/70 bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300"
        >
          Join a Series
        </Link>
      </div>

      {/* Series cards */}
      {visibleSeriesList.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-6 text-center">
          <p className="text-sm text-neutral-400">
            No series yet. Check back later or join a private series with an invite code.
          </p>
          <Link
            href="/series/join"
            className="mt-3 inline-block text-sm font-semibold text-amber-200/80 underline hover:text-amber-200"
          >
            Join a Series
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSeriesList.map((series) => (
            <Link
              key={series.id}
              href={`/series/${series.id}`}
              className="block rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm transition-colors hover:border-amber-400/60 hover:bg-neutral-900"
            >
              <h2 className="font-semibold text-neutral-50">{series.name}</h2>
              {series.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{series.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-neutral-500">
                {series.startDate && series.endDate
                  ? `${formatDateTime(series.startDate)} – ${formatDateTime(series.endDate)}`
                  : "Ongoing"}
              </p>
              <span className="mt-2 inline-block text-xs font-medium text-amber-200/80 hover:text-amber-200">
                View series →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
