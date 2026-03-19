import { prisma } from "@/lib/prisma";
import { getSportsProvider } from "@/lib/sports/provider";
import { computeBasketballFantasyPoints } from "@/lib/scoring-basketball";

export type PullResult = { updated: number; skipped: number };

/**
 * Pull live basketball stats for one contest from external provider (e.g. SportsDataIO).
 * Updates lanes' basketball* and liveFantasyPoints; updates contest lastLiveStatsPullAt and game state.
 * Throws on validation or provider error.
 */
export async function runBasketballLiveStatsPull(contestId: string): Promise<PullResult> {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      homeTeam: { include: { league: { select: { externalId: true } } } },
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
      "Contest must have externalProvider=sportsdataio and externalId (game id) to ingest live stats."
    );
  }

  const provider = getSportsProvider("sportsdataio");
  if (!provider.getLivePlayerStatsForGame) {
    throw new Error("Provider does not support live player stats for this game.");
  }

  const leagueId = contest.homeTeam?.league?.externalId ?? undefined;
  const result = await provider.getLivePlayerStatsForGame(externalGameId, leagueId);
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

    const raw = row.rawStats;
    const basketballPoints = raw.points ?? null;
    const basketballRebounds = raw.rebounds ?? null;
    const basketballAssists = raw.assists ?? null;
    const basketballSteals = raw.steals ?? null;
    const basketballBlocks = raw.blocks ?? null;
    const basketballTurnovers = raw.turnovers ?? null;
    const basketballThreesMade = raw.threePointersMade ?? null;

    const liveFantasyPoints = computeBasketballFantasyPoints({
      points: basketballPoints ?? 0,
      rebounds: basketballRebounds ?? 0,
      assists: basketballAssists ?? 0,
      steals: basketballSteals ?? 0,
      blocks: basketballBlocks ?? 0,
      turnovers: basketballTurnovers ?? 0,
      threePointersMade: basketballThreesMade ?? 0,
    });

    await prisma.lane.update({
      where: { id: lane.id },
      data: {
        basketballPoints,
        basketballRebounds,
        basketballAssists,
        basketballSteals,
        basketballBlocks,
        basketballTurnovers,
        basketballThreesMade,
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
