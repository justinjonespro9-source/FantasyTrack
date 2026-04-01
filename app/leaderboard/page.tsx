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

  const seriesForLeaderboard = await prisma.series.findMany({
    where: {
      isActive: true,
    },
    select: { id: true, name: true, startDate: true },
    orderBy: { startDate: "desc" },
  });

  let seriesLeaderboards: {
    id: string;
    name: string;
    entries: (LeaderboardEntry & { primaryBadge?: { label: string } | null })[];
  }[] = [];

  if (seriesForLeaderboard.length > 0) {
    seriesLeaderboards = await Promise.all(
      seriesForLeaderboard.map(async (series) => {
        const rows = await getSeriesLeaderboard(series.id, false);
        const entries = rows.map((row) => ({
          ...row,
          primaryBadge: resolvePrimaryBadgeForLeaderboard(row),
        }));
        return { id: series.id, name: series.name, entries };
      })
    );
  }

  return (
    <div className="space-y-6">
      <LeaderboardClient
        overall={overallEntries}
        seriesLeaderboards={seriesLeaderboards}
        currentUserId={currentUserId}
      />
    </div>
  );
}

