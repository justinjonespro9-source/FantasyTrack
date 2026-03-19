import { getGlobalLeaderboard, getSeriesLeaderboard, type LeaderboardEntry } from "@/lib/market";
import { resolvePrimaryBadgeForLeaderboard } from "@/lib/badges";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage() {
  const session = await getCurrentSession();
  const currentUserId = session?.user?.id ?? null;

  const globalRows = await getGlobalLeaderboard(false);
  const overallEntries = globalRows.map((row) => ({
    ...row,
    primaryBadge: resolvePrimaryBadgeForLeaderboard(row),
  }));

  let seriesLeaderboards: {
    id: string;
    name: string;
    entries: (LeaderboardEntry & { primaryBadge?: { label: string } | null })[];
  }[] = [];

  if (currentUserId) {
    const memberships = await prisma.seriesMembership.findMany({
      where: { userId: currentUserId },
      include: {
        series: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const seenSeries = new Set<string>();
    const uniqueSeries = memberships
      .map((m) => m.series)
      .filter((s) => {
        if (seenSeries.has(s.id)) return false;
        seenSeries.add(s.id);
        return true;
      });

    if (uniqueSeries.length > 0) {
      seriesLeaderboards = await Promise.all(
        uniqueSeries.map(async (series) => {
          const rows = await getSeriesLeaderboard(series.id, false);
          const entries = rows.map((row) => ({
            ...row,
            primaryBadge: resolvePrimaryBadgeForLeaderboard(row),
          }));
          return { id: series.id, name: series.name, entries };
        })
      );
    }
  }

  return (
    <div className="space-y-4">
      <LeaderboardClient
        overall={overallEntries}
        seriesLeaderboards={seriesLeaderboards}
        currentUserId={currentUserId}
      />
    </div>
  );
}

