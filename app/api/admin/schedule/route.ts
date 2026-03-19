import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSportsProvider } from "@/lib/sports/provider";
import { getSportsDataIOTeamIdMap } from "@/lib/sports/sportsdataio/unified-provider";
import type { ProviderName } from "@/lib/sports/types";

const SCHEDULE_DAYS_PAST = 7;
const SCHEDULE_DAYS_AHEAD = 60;

export async function GET(req: NextRequest) {
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

  const leagueId = req.nextUrl.searchParams.get("leagueId");
  if (!leagueId) {
    return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, sport: true, externalId: true, externalProvider: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const externalLeagueId = league.externalId;
  const providerName = (league.externalProvider as ProviderName) ?? "mock";

  if (!externalLeagueId) {
    return NextResponse.json({
      games: [],
      message: "League has no external id; add one to load schedule from provider.",
    });
  }

  const start = new Date();
  start.setDate(start.getDate() - SCHEDULE_DAYS_PAST);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + SCHEDULE_DAYS_AHEAD);
  end.setHours(23, 59, 59, 999);

  const provider = getSportsProvider(providerName);
  const externalGames = await provider.getSchedule(externalLeagueId, { start, end });

  const teamIdMap =
    providerName === "sportsdataio" ? await getSportsDataIOTeamIdMap(externalLeagueId) : {};

  const games: {
    id: string;
    startTime: string;
    homeTeamId: string;
    awayTeamId: string;
    homeLabel: string;
    awayLabel: string;
    externalId: string;
    externalProvider: string;
  }[] = [];

  for (const game of externalGames) {
    const homeKey = (teamIdMap[game.homeTeamId] ?? game.homeTeamId).trim();
    const awayKey = (teamIdMap[game.awayTeamId] ?? game.awayTeamId).trim();

    // SportsDataIO team keys (e.g. "HOU") collide across leagues (NBA/NCAA).
    // Scope stored Team.externalId by league so schedule resolution can't cross leagues.
    const scopedHomeExternalId = `${externalLeagueId}:${homeKey}`;
    const scopedAwayExternalId = `${externalLeagueId}:${awayKey}`;
    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.findFirst({
        where: {
          externalId: scopedHomeExternalId,
          externalProvider: game.provider,
          leagueId: league.id,
        },
        select: { id: true, name: true, market: true },
      }),
      prisma.team.findFirst({
        where: {
          externalId: scopedAwayExternalId,
          externalProvider: game.provider,
          leagueId: league.id,
        },
        select: { id: true, name: true, market: true },
      }),
    ]);

    if (!homeTeam || !awayTeam) continue;

    const homeLabel = [homeTeam.market, homeTeam.name].filter(Boolean).join(" ");
    const awayLabel = [awayTeam.market, awayTeam.name].filter(Boolean).join(" ");

    games.push({
      id: game.id,
      startTime: game.startTime.toISOString(),
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeLabel,
      awayLabel,
      externalId: game.id,
      externalProvider: game.provider,
    });
  }

  games.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return NextResponse.json({ games, sport: league.sport });
}
