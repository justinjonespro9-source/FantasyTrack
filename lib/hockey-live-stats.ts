import { prisma } from "@/lib/prisma";
import { getSportsProvider } from "@/lib/sports/provider";
import { computeHockeyFantasyPoints } from "@/lib/scoring-hockey";

export type HockeyPullResult = { updated: number; skipped: number };

/**
 * Pull live NHL stats for one contest from external provider (e.g. SportsDataIO).
 * Updates lanes' hockey* fields and liveFantasyPoints; updates contest lastLiveStatsPullAt and game state.
 */
export async function runHockeyLiveStatsPull(contestId: string): Promise<HockeyPullResult> {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      homeTeam: { include: { league: { select: { externalId: true, externalProvider: true } } } },
      lanes: {
        include: {
          player: {
            select: { id: true, externalId: true, externalProvider: true },
          },
        },
      },
    },
  });

  if (!contest) {
    throw new Error("Contest not found");
  }

  const providerName = contest.externalProvider ?? "";
  const externalGameId = contest.externalId ?? "";

  if (providerName !== "sportsdataio" || !externalGameId) {
    throw new Error(
      "Contest must have externalProvider=sportsdataio and externalId (game id) to ingest NHL live stats."
    );
  }

  const leagueExternalId = contest.homeTeam?.league?.externalId ?? undefined;
  const leagueExternalProvider = contest.homeTeam?.league?.externalProvider ?? undefined;
  let leagueIdForProvider =
    leagueExternalProvider === "sportsdataio" ? leagueExternalId : undefined;
  // If contest has no home team / league (e.g. manually created then linked to game), use sport to route NHL.
  if (!leagueIdForProvider && contest.sport === "HOCKEY") {
    leagueIdForProvider = "nhl";
  }

  const provider = getSportsProvider("sportsdataio");
  if (!provider.getLivePlayerStatsForGame) {
    throw new Error("Provider does not support live player stats for this game.");
  }

  const result = await provider.getLivePlayerStatsForGame(externalGameId, leagueIdForProvider);
  const stats = result.stats;
  const gameState = result.gameState ?? null;

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const row of stats) {
    const lane = contest.lanes.find(
      (l) =>
        l.player?.externalProvider === providerName &&
        l.player?.externalId === row.playerId
    );

    if (!lane) {
      skipped.push(row.playerId);
      continue;
    }

    const raw = row.rawStats as any;

    const hockeyGoals = raw.goals ?? null;
    const hockeyAssists = raw.assists ?? null;
    const hockeyShortHandedGoals = raw.shortHandedGoals ?? null;
    const hockeyShortHandedAssists = raw.shortHandedAssists ?? null;
    const hockeyShotsOnGoal = raw.shotsOnGoal ?? null;
    const hockeyShootoutGoals = raw.shootoutGoals ?? null;
    const hockeyBlockedShots = raw.blockedShots ?? null;

    const hockeySaves = raw.saves ?? null;
    const hockeyGoalsAgainst = raw.goalsAgainst ?? null;
    const hockeyShutouts = raw.shutouts ?? null;
    const hockeyWins = raw.wins ?? null;
    const hockeyOvertimeLosses = raw.overtimeLosses ?? null;

    const liveFantasyPoints = computeHockeyFantasyPoints({
      goals: hockeyGoals ?? 0,
      assists: hockeyAssists ?? 0,
      shortHandedGoals: hockeyShortHandedGoals ?? 0,
      shortHandedAssists: hockeyShortHandedAssists ?? 0,
      shotsOnGoal: hockeyShotsOnGoal ?? 0,
      shootoutGoals: hockeyShootoutGoals ?? 0,
      blockedShots: hockeyBlockedShots ?? 0,
      saves: hockeySaves ?? 0,
      goalsAgainst: hockeyGoalsAgainst ?? 0,
      shutouts: hockeyShutouts ?? 0,
      wins: hockeyWins ?? 0,
      overtimeLosses: hockeyOvertimeLosses ?? 0,
    });

    await prisma.lane.update({
      where: { id: lane.id },
      data: {
        hockeyGoals,
        hockeyAssists,
        hockeyShortHandedGoals,
        hockeyShortHandedAssists,
        hockeyShotsOnGoal,
        hockeyShootoutGoals,
        hockeyBlocks: hockeyBlockedShots,
        hockeySaves,
        hockeyGoalsAgainst,
        hockeyShutouts,
        hockeyWins,
        hockeyOvertimeLosses,
        liveFantasyPoints,
      } as any,
    });

    updated.push(lane.id);
  }

  await prisma.contest.update({
    where: { id: contestId },
    data: {
      lastLiveStatsPullAt: new Date(),
      lastLiveStatsUpdatedCount: updated.length,
      ...(gameState != null
        ? {
            liveGameProgress: Math.min(100, Math.max(0, Math.round(gameState.progressPercent))),
            liveGameStatus: gameState.status,
          }
        : {}),
    },
  });

  return { updated: updated.length, skipped: skipped.length };
}

