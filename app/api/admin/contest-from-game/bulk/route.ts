import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

type GamePayload = {
  startTime: string;
  homeTeamId: string;
  awayTeamId: string;
  externalProvider: string;
  externalId: string;
  homeLabel: string;
  awayLabel: string;
};

export async function POST(req: NextRequest) {
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

  let body: { seriesId?: string; sport?: string; games?: GamePayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { seriesId, sport, games: gamesPayload } = body;
  if (!seriesId || !sport || !Array.isArray(gamesPayload) || gamesPayload.length === 0) {
    return NextResponse.json(
      { error: "seriesId, sport, and a non-empty games array are required." },
      { status: 400 }
    );
  }

  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true },
  });
  if (!series) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const created: { id: string; title: string; externalId: string }[] = [];
  const skipped: { externalId: string; reason: string }[] = [];
  const failed: { externalId: string; reason: string }[] = [];

  for (const g of gamesPayload) {
    const externalId = g.externalId ?? "";
    const externalProvider = g.externalProvider ?? "";

    if (
      !g.startTime ||
      !g.homeTeamId ||
      !g.awayTeamId ||
      !externalProvider ||
      !externalId ||
      !g.homeLabel ||
      !g.awayLabel
    ) {
      failed.push({ externalId: externalId || "?", reason: "Missing required fields" });
      continue;
    }

    const startDate = new Date(g.startTime);
    if (Number.isNaN(startDate.getTime())) {
      failed.push({ externalId, reason: "Invalid startTime" });
      continue;
    }

    const existing = await prisma.contest.findUnique({
      where: {
        externalProvider_externalId: { externalProvider, externalId },
      },
      select: { id: true },
    });
    if (existing) {
      skipped.push({ externalId, reason: "Contest already exists for this game" });
      continue;
    }

    try {
      const contest = await prisma.contest.create({
        data: {
          seriesId,
          title: `${g.awayLabel} @ ${g.homeLabel}`,
          sport,
          startTime: startDate,
          status: "DRAFT",
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          externalProvider,
          externalId,
        },
        select: { id: true, title: true },
      });
      created.push({ id: contest.id, title: contest.title, externalId });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Create failed";
      failed.push({ externalId, reason });
    }
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    createdContests: created,
    skippedGames: skipped,
    failedGames: failed,
  });
}
