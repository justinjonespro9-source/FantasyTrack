import { ContestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  POSITION_RACE_ORDER,
  type PositionRaceKey,
} from "@/lib/position-races/types";

const LIVE_STATUSES: ContestStatus[] = [
  ContestStatus.PUBLISHED,
  ContestStatus.LOCKED,
];

export type SelectedPositionContest = {
  id: string;
  title: string;
  sport: string;
  status: ContestStatus;
  startTime: Date;
  season: number | null;
  week: number | null;
  slate: string | null;
  scoringFormat: string | null;
  contestType: string | null;
  position: PositionRaceKey;
  series: { id: string; name: string; isPrivate: boolean } | null;
};

function normalizePosition(raw: string | null | undefined): PositionRaceKey | null {
  const p = (raw ?? "").trim().toUpperCase();
  if (p === "QB" || p === "RB" || p === "WR" || p === "TE") return p;
  return null;
}

function positionFromTitle(title: string): PositionRaceKey | null {
  const upper = title.toUpperCase();
  for (const pos of POSITION_RACE_ORDER) {
    if (new RegExp(`\\b${pos}\\b`).test(upper)) return pos;
  }
  return null;
}

/**
 * Pick one public Week N position race per QB/RB/WR/TE.
 * Prefers PUBLISHED/LOCKED over DRAFT, then higher ticket activity, then newer contests.
 */
export async function selectWeekPositionRaces(params?: {
  week?: number;
  season?: number;
}): Promise<{
  week: number;
  season: number;
  contests: SelectedPositionContest[];
}> {
  const week = params?.week ?? Number(process.env.POSITION_RACES_WEEK || 1);
  const season = params?.season ?? Number(process.env.POSITION_RACES_SEASON || 2026);

  const rows = await prisma.contest.findMany({
    where: {
      archivedAt: null,
      week,
      season,
      sport: { in: ["FOOTBALL", "NFL"] },
      OR: [
        { contestType: "POSITION_WEEKLY" },
        { contestType: null },
        { title: { contains: "Race", mode: "insensitive" } },
        { title: { contains: "Week", mode: "insensitive" } },
      ],
      status: { in: [...LIVE_STATUSES, ContestStatus.DRAFT] },
      series: { isPrivate: false },
    },
    select: {
      id: true,
      title: true,
      sport: true,
      status: true,
      startTime: true,
      season: true,
      week: true,
      slate: true,
      scoringFormat: true,
      contestType: true,
      createdAt: true,
      series: { select: { id: true, name: true, isPrivate: true } },
      lanes: {
        select: { position: true },
        take: 8,
        orderBy: [{ seedRank: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      },
      _count: { select: { tickets: true, lanes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const byPosition = new Map<PositionRaceKey, (typeof rows)[number]>();

  const rankCandidate = (c: (typeof rows)[number]) => {
    const live = LIVE_STATUSES.includes(c.status) ? 0 : 1;
    const tickets = c._count.tickets;
    const lanes = c._count.lanes;
    const created = c.createdAt.getTime();
    return { live, tickets, lanes, created };
  };

  const isBetter = (next: (typeof rows)[number], prev: (typeof rows)[number]) => {
    const a = rankCandidate(next);
    const b = rankCandidate(prev);
    if (a.live !== b.live) return a.live < b.live;
    if (a.tickets !== b.tickets) return a.tickets > b.tickets;
    if (a.lanes !== b.lanes) return a.lanes > b.lanes;
    return a.created > b.created;
  };

  for (const row of rows) {
    if (row._count.lanes < 4) continue;
    const fromLanes =
      normalizePosition(row.lanes.find((l) => normalizePosition(l.position))?.position) ??
      null;
    const position = fromLanes ?? positionFromTitle(row.title);
    if (!position) continue;

    const existing = byPosition.get(position);
    if (!existing || isBetter(row, existing)) {
      byPosition.set(position, row);
    }
  }

  const contests: SelectedPositionContest[] = POSITION_RACE_ORDER.flatMap((pos) => {
    const row = byPosition.get(pos);
    if (!row) return [];
    // Prefer live statuses for lobby display; allow DRAFT only if nothing else.
    if (!LIVE_STATUSES.includes(row.status) && row.status !== ContestStatus.DRAFT) {
      return [];
    }
    return [
      {
        id: row.id,
        title: row.title,
        sport: row.sport,
        status: row.status,
        startTime: row.startTime,
        season: row.season,
        week: row.week,
        slate: row.slate,
        scoringFormat: row.scoringFormat,
        contestType: row.contestType,
        position: pos,
        series: row.series,
      },
    ];
  });

  return { week, season, contests };
}

export async function loadOtherPublicContests(
  excludeIds: string[],
  take = 8
): Promise<
  Array<{
    id: string;
    title: string;
    sport: string;
    status: ContestStatus;
    startTime: Date;
    seriesName: string | null;
  }>
> {
  const now = new Date();
  return prisma.contest.findMany({
    where: {
      archivedAt: null,
      id: { notIn: excludeIds.length ? excludeIds : ["__none__"] },
      series: { isPrivate: false },
      OR: [
        { status: ContestStatus.PUBLISHED, startTime: { gt: now } },
        { status: ContestStatus.LOCKED, settledAt: null },
        {
          status: ContestStatus.SETTLED,
          settledAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
        },
      ],
    },
    orderBy: [{ startTime: "asc" }],
    take,
    select: {
      id: true,
      title: true,
      sport: true,
      status: true,
      startTime: true,
      series: { select: { name: true } },
    },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      sport: r.sport,
      status: r.status,
      startTime: r.startTime,
      seriesName: r.series?.name ?? null,
    }))
  );
}
