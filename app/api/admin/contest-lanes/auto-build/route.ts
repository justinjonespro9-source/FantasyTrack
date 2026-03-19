import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { createLanesFromPlayers } from "@/lib/sports/contest-lane-bridge";

/**
 * POST /api/admin/contest-lanes/auto-build
 *
 * For basketball contests with home/away teams: create lanes for all players
 * on those two teams. Skips players that already have a lane (no duplicates).
 * Body: { contestId: string }
 * Auth: admin only.
 */
export async function POST(req: Request) {
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
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contestId = typeof body.contestId === "string" ? body.contestId.trim() : "";
  if (!contestId) {
    return NextResponse.json({ error: "contestId is required" }, { status: 400 });
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { id: true, sport: true, homeTeamId: true, awayTeamId: true },
  });

  if (!contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  if (contest.sport !== "BASKETBALL") {
    return NextResponse.json(
      { error: "Auto-build lanes is only supported for basketball contests." },
      { status: 400 }
    );
  }

  if (!contest.homeTeamId || !contest.awayTeamId) {
    return NextResponse.json(
      { error: "Contest must have home and away teams set to auto-build lanes." },
      { status: 400 }
    );
  }

  const players = await prisma.player.findMany({
    where: {
      teamId: { in: [contest.homeTeamId, contest.awayTeamId] },
      active: true,
    },
    select: { id: true },
  });

  const playerIds = players.map((p) => p.id);
  if (playerIds.length === 0) {
    return NextResponse.json(
      { error: "No players found for this contest's home and away teams. Import teams and players first." },
      { status: 400 }
    );
  }

  const result = await createLanesFromPlayers(contestId, playerIds);

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/contest/${contestId}`);

  return NextResponse.json({
    ok: true,
    created: result.created,
    skipped: result.skipped,
    totalPlayers: playerIds.length,
  });
}
