import { ContestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeContestSport,
  type RaceSportKey,
} from "@/lib/races/sport-config";

export type DiscoverableRace = {
  id: string;
  title: string;
  sport: string;
  sportKey: RaceSportKey;
  status: ContestStatus;
  startTime: string;
  seriesName: string | null;
  bucket: "open" | "upcoming" | "completed";
};

/**
 * Lightweight public race list for Football / Basketball / Hockey sections
 * beneath the featured position-race boards. Excludes featured IDs.
 */
export async function discoverPublicRacesBySport(params: {
  excludeIds: string[];
  takePerSport?: number;
}): Promise<Record<RaceSportKey, DiscoverableRace[]>> {
  const takePerSport = params.takePerSport ?? 8;
  const now = new Date();
  const exclude = params.excludeIds.length ? params.excludeIds : ["__none__"];

  const rows = await prisma.contest.findMany({
    where: {
      archivedAt: null,
      id: { notIn: exclude },
      series: { isPrivate: false },
      OR: [
        { status: ContestStatus.PUBLISHED },
        { status: ContestStatus.LOCKED, settledAt: null },
        {
          status: ContestStatus.SETTLED,
          settledAt: { gte: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000) },
        },
      ],
    },
    orderBy: [{ startTime: "asc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      sport: true,
      status: true,
      startTime: true,
      settledAt: true,
      series: { select: { name: true } },
    },
  });

  const empty = (): DiscoverableRace[] => [];
  const bySport: Record<RaceSportKey, DiscoverableRace[]> = {
    football: empty(),
    basketball: empty(),
    hockey: empty(),
    other: empty(),
  };

  for (const row of rows) {
    const sportKey = normalizeContestSport(row.sport);
    let bucket: DiscoverableRace["bucket"] = "upcoming";
    if (row.status === ContestStatus.SETTLED) bucket = "completed";
    else if (row.status === ContestStatus.LOCKED) bucket = "open";
    else if (row.status === ContestStatus.PUBLISHED) {
      bucket = row.startTime > now ? "upcoming" : "open";
    }

    const list = bySport[sportKey];
    if (list.length >= takePerSport) continue;
    list.push({
      id: row.id,
      title: row.title,
      sport: row.sport,
      sportKey,
      status: row.status,
      startTime: row.startTime.toISOString(),
      seriesName: row.series?.name ?? null,
      bucket,
    });
  }

  return bySport;
}
