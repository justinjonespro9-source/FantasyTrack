import { ContestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getContestOddsData } from "@/lib/market";
import {
  buildWeeklyRaceHeadline,
  formatContestLifecycleLabel,
  formatScoringLabel,
  formatSlateLabel,
} from "@/lib/contest-presentation";
import { compareLanesByProjectedRank } from "@/lib/admin/lane-sort";
import {
  loadOtherPublicContests,
  selectWeekPositionRaces,
} from "@/lib/position-races/select";
import type {
  FeaturedPlayer,
  LobbyLaneRow,
  MarketSnapshot,
  PositionRaceCard,
  PositionRaceKey,
  PositionRacesLobbyPayload,
} from "@/lib/position-races/types";

/** Align with contest-board: market order once WIN pool is meaningful. */
export const LOBBY_MEANINGFUL_POOL_THRESHOLD = 25;
const TOP_LANE_COUNT = 12;

function formatOddsLabel(winMultiple: number | null): string {
  if (winMultiple == null) return "Odds not established";
  const oddsTo1 = Math.max(winMultiple - 1, 0);
  if (oddsTo1 < 1) return `${winMultiple.toFixed(2)}x`;
  return `${oddsTo1.toFixed(0)}-1`;
}

function sortTopLanes(
  lanes: Array<{
    id: string;
    name: string;
    team: string;
    position: string;
    seedRank: number | null;
    displayOrder: number | null;
    projectedPoints: number | null;
    status: string;
  }>,
  odds: Awaited<ReturnType<typeof getContestOddsData>>,
  hasMeaningfulPool: boolean
): LobbyLaneRow[] {
  const winPool = odds?.poolTotals.WIN ?? 0;

  const enriched = lanes
    .filter((l) => l.status !== "SCRATCHED")
    .map((lane) => {
      const winPoolAmount = odds?.laneTotals[lane.id]?.WIN ?? 0;
      const winMultiple = odds?.estMultiples[lane.id]?.WIN ?? null;
      return {
        lane,
        winPoolAmount,
        winMultiple,
        projectedRank: lane.seedRank ?? lane.displayOrder ?? null,
      };
    });

  enriched.sort((a, b) => {
    if (hasMeaningfulPool) {
      if (a.winPoolAmount !== b.winPoolAmount) return b.winPoolAmount - a.winPoolAmount;
      const aM = a.winMultiple ?? 9999;
      const bM = b.winMultiple ?? 9999;
      if (aM !== bM) return aM - bM;
    }
    return compareLanesByProjectedRank(a.lane, b.lane);
  });

  const marketOrder = [...enriched].sort((a, b) => {
    if (a.winPoolAmount !== b.winPoolAmount) return b.winPoolAmount - a.winPoolAmount;
    const aM = a.winMultiple ?? 9999;
    const bM = b.winMultiple ?? 9999;
    if (aM !== bM) return aM - bM;
    return compareLanesByProjectedRank(a.lane, b.lane);
  });
  const marketRankById = new Map<string, number>();
  marketOrder.forEach((row, idx) => marketRankById.set(row.lane.id, idx + 1));

  return enriched.slice(0, TOP_LANE_COUNT).map((row) => {
    const oddsEstablished = row.winMultiple != null;
    return {
      id: row.lane.id,
      name: row.lane.name,
      team: row.lane.team,
      position: row.lane.position,
      projectedRank: row.projectedRank,
      projectedPoints: row.lane.projectedPoints,
      marketRank: hasMeaningfulPool ? marketRankById.get(row.lane.id) ?? null : null,
      winPoolAmount: row.winPoolAmount,
      poolSharePct:
        winPool > 0 && row.winPoolAmount > 0
          ? Number(((row.winPoolAmount / winPool) * 100).toFixed(1))
          : null,
      winMultiple: row.winMultiple,
      oddsLabel: formatOddsLabel(row.winMultiple),
      oddsEstablished,
    };
  });
}

function buildFeaturedFromRaces(races: PositionRaceCard[]): {
  featuredLongShots: FeaturedPlayer[];
  playersToWatch: FeaturedPlayer[];
  marketSnapshot: MarketSnapshot;
} {
  const anyOdds = races.some((r) => r.hasMeaningfulPool);

  const longShots: FeaturedPlayer[] = [];
  if (anyOdds) {
    for (const race of races) {
      for (const lane of race.topLanes) {
        if (!lane.oddsEstablished || lane.winMultiple == null) continue;
        longShots.push({
          contestId: race.contestId,
          position: race.position,
          laneId: lane.id,
          name: lane.name,
          team: lane.team,
          oddsLabel: lane.oddsLabel,
          poolSharePct: lane.poolSharePct,
          projectedRank: lane.projectedRank,
          winMultiple: lane.winMultiple,
        });
      }
    }
    longShots.sort((a, b) => (b.winMultiple ?? 0) - (a.winMultiple ?? 0));
  }

  const playersToWatch: FeaturedPlayer[] = [];
  for (const race of races) {
    const candidate = race.topLanes.find((l) => (l.projectedRank ?? 99) >= 8) ?? race.topLanes[3];
    if (!candidate) continue;
    playersToWatch.push({
      contestId: race.contestId,
      position: race.position,
      laneId: candidate.id,
      name: candidate.name,
      team: candidate.team,
      oddsLabel: candidate.oddsLabel,
      poolSharePct: candidate.poolSharePct,
      projectedRank: candidate.projectedRank,
      winMultiple: candidate.winMultiple,
    });
  }

  let mostBacked: FeaturedPlayer | null = null;
  let largestPool: MarketSnapshot["largestPool"] = null;
  let closestRace: MarketSnapshot["closestRace"] = null;
  let bestAmt = -1;

  for (const race of races) {
    if (!largestPool || race.poolTotal > largestPool.poolTotal) {
      largestPool = {
        position: race.position,
        contestId: race.contestId,
        poolTotal: race.poolTotal,
      };
    }

    for (const lane of race.topLanes) {
      if (lane.winPoolAmount > bestAmt) {
        bestAmt = lane.winPoolAmount;
        mostBacked = {
          contestId: race.contestId,
          position: race.position,
          laneId: lane.id,
          name: lane.name,
          team: lane.team,
          oddsLabel: lane.oddsLabel,
          poolSharePct: lane.poolSharePct,
          projectedRank: lane.projectedRank,
          winMultiple: lane.winMultiple,
        };
      }
    }

    const leader = race.topLanes[0];
    const second = race.topLanes[1];
    if (
      race.hasMeaningfulPool &&
      leader?.poolSharePct != null &&
      second?.poolSharePct != null
    ) {
      const gap = Math.abs(leader.poolSharePct - second.poolSharePct);
      if (
        !closestRace ||
        gap < Math.abs(closestRace.leaderSharePct - closestRace.secondSharePct)
      ) {
        closestRace = {
          position: race.position,
          contestId: race.contestId,
          leaderName: leader.name,
          leaderSharePct: leader.poolSharePct,
          secondName: second.name,
          secondSharePct: second.poolSharePct,
        };
      }
    }
  }
  if (bestAmt <= 0) mostBacked = null;

  const totalEntries = races.reduce((s, r) => s + r.entryCount, 0);
  const lockTimes = races
    .filter((r) => r.status === ContestStatus.PUBLISHED)
    .map((r) => r.timeToLockSeconds);
  const earliestLockSeconds = lockTimes.length ? Math.min(...lockTimes) : null;

  return {
    featuredLongShots: longShots.slice(0, 4),
    playersToWatch: playersToWatch.slice(0, 4),
    marketSnapshot: {
      mostBacked,
      largestPool,
      closestRace,
      totalEntries,
      earliestLockSeconds,
    },
  };
}

export async function buildPositionRacesLobby(params?: {
  week?: number;
  season?: number;
}): Promise<PositionRacesLobbyPayload> {
  const { week, season, contests } = await selectWeekPositionRaces(params);

  const contestIds = contests.map((c) => c.id);

  const [allLanes, ticketGroups, oddsList] = await Promise.all([
    contestIds.length
      ? prisma.lane.findMany({
          where: { contestId: { in: contestIds } },
          select: {
            id: true,
            contestId: true,
            name: true,
            team: true,
            position: true,
            seedRank: true,
            displayOrder: true,
            projectedPoints: true,
            status: true,
          },
          orderBy: [{ seedRank: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    contestIds.length
      ? prisma.ticket.groupBy({
          by: ["contestId"],
          where: { contestId: { in: contestIds }, status: { not: "VOIDED" } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    Promise.all(contestIds.map((id) => getContestOddsData(id))),
  ]);

  const lanesByContest = new Map<string, typeof allLanes>();
  for (const lane of allLanes) {
    const list = lanesByContest.get(lane.contestId) ?? [];
    list.push(lane);
    lanesByContest.set(lane.contestId, list);
  }
  const ticketsByContest = new Map(
    ticketGroups.map((g) => [g.contestId, g._count._all])
  );
  const oddsByContest = new Map(
    contestIds.map((id, idx) => [id, oddsList[idx] ?? null])
  );

  const races: PositionRaceCard[] = contests.map((contest) => {
    const lanes = lanesByContest.get(contest.id) ?? [];
    const odds = oddsByContest.get(contest.id) ?? null;
    const ticketCount = ticketsByContest.get(contest.id) ?? 0;
    const winPoolTotal = odds?.poolTotals.WIN ?? 0;
    const poolTotal =
      (odds?.poolTotals.WIN ?? 0) +
      (odds?.poolTotals.PLACE ?? 0) +
      (odds?.poolTotals.SHOW ?? 0);
    const hasMeaningfulPool = winPoolTotal >= LOBBY_MEANINGFUL_POOL_THRESHOLD;
    const copy = buildWeeklyRaceHeadline({
      title: contest.title,
      sport: contest.sport,
      season: contest.season,
      week: contest.week,
      position: contest.position,
    });

    return {
      contestId: contest.id,
      position: contest.position as PositionRaceKey,
      title: contest.title,
      headline: copy.headline,
      supportingCopy: copy.supporting,
      status: contest.status,
      lifecycleLabel: formatContestLifecycleLabel(contest.status),
      startTime: contest.startTime.toISOString(),
      timeToLockSeconds:
        odds?.timeToLockSeconds ??
        Math.max(0, Math.floor((contest.startTime.getTime() - Date.now()) / 1000)),
      runnerCount: lanes.length,
      entryCount: ticketCount,
      poolTotal,
      winPoolTotal,
      hasMeaningfulPool,
      slateLabel: formatSlateLabel(contest.slate),
      scoringLabel: formatScoringLabel(contest.scoringFormat),
      topLanes: sortTopLanes(lanes, odds, hasMeaningfulPool),
    };
  });

  const modules = buildFeaturedFromRaces(races);
  const other = await loadOtherPublicContests(races.map((r) => r.contestId));

  const earliestLockSeconds = races
    .filter((r) => r.status === ContestStatus.PUBLISHED)
    .map((r) => r.timeToLockSeconds);
  const earliest =
    earliestLockSeconds.length > 0 ? Math.min(...earliestLockSeconds) : null;
  const earliestContest = races.find(
    (r) => r.status === ContestStatus.PUBLISHED && r.timeToLockSeconds === earliest
  );

  return {
    week,
    season,
    generatedAt: new Date().toISOString(),
    races,
    totals: {
      activeRaces: races.filter((r) =>
        r.status === ContestStatus.PUBLISHED || r.status === ContestStatus.LOCKED
      ).length,
      totalEntries: races.reduce((s, r) => s + r.entryCount, 0),
      totalPool: races.reduce((s, r) => s + r.poolTotal, 0),
      earliestLockSeconds: earliest,
      earliestLockTime: earliestContest?.startTime ?? null,
    },
    featuredLongShots: modules.featuredLongShots,
    playersToWatch: modules.playersToWatch,
    marketSnapshot: modules.marketSnapshot,
    otherContests: other.map((c) => ({
      id: c.id,
      title: c.title,
      sport: c.sport,
      status: c.status,
      startTime: c.startTime.toISOString(),
      seriesName: c.seriesName,
    })),
    movementAvailable: false,
  };
}
