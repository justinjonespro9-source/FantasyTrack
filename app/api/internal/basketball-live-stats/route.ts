import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSportsProvider } from "@/lib/sports/provider";
import { computeBasketballFantasyPoints } from "@/lib/scoring-basketball";
import { revalidatePath } from "next/cache";

/**
 * POST /api/internal/basketball-live-stats
 *
 * Ingests live player stats from the contest's external provider (e.g. SportsDataIO CBB)
 * and updates lanes' basketball* fields and liveFantasyPoints. Provider-agnostic: uses
 * normalized stats from the provider adapter.
 *
 * Body: { contestId: string }
 * Auth: admin only (Phase 1).
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { contestId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contestId = typeof body.contestId === "string" ? body.contestId.trim() : "";
  if (!contestId) {
    return NextResponse.json({ error: "contestId is required" }, { status: 400 });
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
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
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const providerName = contest.externalProvider ?? "";
  const externalGameId = contest.externalId ?? "";

  if (providerName !== "sportsdataio" || !externalGameId) {
    return NextResponse.json(
      {
        error:
          "Contest must have externalProvider=sportsdataio and externalId (game id) to ingest live stats.",
      },
      { status: 400 }
    );
  }

  const provider = getSportsProvider("sportsdataio");
  if (!provider.getLivePlayerStatsForGame) {
    return NextResponse.json(
      { error: "Provider does not support live player stats for this game." },
      { status: 501 }
    );
  }

  let stats: Awaited<ReturnType<NonNullable<typeof provider.getLivePlayerStatsForGame>>>["stats"];
  let gameState: Awaited<ReturnType<NonNullable<typeof provider.getLivePlayerStatsForGame>>>["gameState"];
  try {
    const result = await provider.getLivePlayerStatsForGame(externalGameId);
    stats = result.stats;
    gameState = result.gameState ?? null;
  } catch (err) {
    console.error("Basketball live stats fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch live stats from provider." },
      { status: 502 }
    );
  }

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

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    updated: updated.length,
    skipped: skipped.length,
    updatedLaneIds: updated,
  });
}
