import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

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

  let body: {
    seriesId: string;
    sport: string;
    startTime: string;
    homeTeamId: string;
    awayTeamId: string;
    externalProvider: string;
    externalId: string;
    homeLabel: string;
    awayLabel: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    seriesId,
    sport,
    startTime,
    homeTeamId,
    awayTeamId,
    externalProvider,
    externalId,
    homeLabel,
    awayLabel,
  } = body;

  if (
    !seriesId ||
    !sport ||
    !startTime ||
    !homeTeamId ||
    !awayTeamId ||
    !externalProvider ||
    !externalId ||
    !homeLabel ||
    !awayLabel
  ) {
    return NextResponse.json(
      { error: "Missing required fields: seriesId, sport, startTime, homeTeamId, awayTeamId, externalProvider, externalId, homeLabel, awayLabel" },
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

  const startDate = new Date(startTime);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  const title = `${awayLabel} @ ${homeLabel}`;

  const existing = await prisma.contest.findUnique({
    where: {
      externalProvider_externalId: { externalProvider, externalId },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A contest already exists for this external game." },
      { status: 409 }
    );
  }

  const contest = await prisma.contest.create({
    data: {
      seriesId,
      title,
      sport,
      startTime: startDate,
      status: "DRAFT",
      homeTeamId,
      awayTeamId,
      externalProvider,
      externalId,
    },
    select: { id: true, title: true, sport: true, startTime: true },
  });

  return NextResponse.json({
    contest: {
      id: contest.id,
      title: contest.title,
      sport: contest.sport,
      startTime: contest.startTime.toISOString(),
    },
  });
}
