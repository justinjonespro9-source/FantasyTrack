import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSportsProvider } from "@/lib/sports/provider";
import type { ExternalLeague, ExternalPlayer, ExternalTeam } from "@/lib/sports/types";

const PROVIDER = "sportsdataio";

/**
 * POST /api/internal/import-nba
 *
 * One-time (or re-runnable) import of NBA league, teams, and players
 * from SportsDataIO NBA.
 *
 * Flow:
 * 1. getLeagues() → find NBA league → upsert League (nba) + Teams via getTeams("nba")
 * 2. For each team: getPlayers(teamId, "nba") → upsert Players
 *
 * Auth: admin only.
 */
export async function POST() {
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

  const provider = getSportsProvider(PROVIDER);
  let leagues: ExternalLeague[];
  try {
    leagues = await provider.getLeagues();
  } catch (err) {
    console.error("Import NBA: getLeagues failed", err);
    return NextResponse.json(
      { error: "Failed to fetch leagues. Is SPORTSDATAIO_API_KEY set?" },
      { status: 502 }
    );
  }

  const nbaLeague = leagues.find((l) => l.id === "nba" || l.code === "NBA");
  if (!nbaLeague) {
    return NextResponse.json(
      { error: "NBA league not found from provider." },
      { status: 502 }
    );
  }

  const league = await prisma.league.upsert({
    where: {
      externalProvider_externalId: { externalProvider: PROVIDER, externalId: nbaLeague.id },
    },
    create: {
      name: nbaLeague.name,
      sport: nbaLeague.sport,
      code: nbaLeague.code,
      externalProvider: PROVIDER,
      externalId: nbaLeague.id,
    },
    update: {
      name: nbaLeague.name,
      sport: nbaLeague.sport,
      code: nbaLeague.code,
    },
  });

  let teams: ExternalTeam[];
  try {
    teams = await provider.getTeams(nbaLeague.id);
  } catch (err) {
    console.error("Import NBA: getTeams failed", err);
    return NextResponse.json(
      { error: "Failed to fetch teams." },
      { status: 502 }
    );
  }

  let playersProcessed = 0;

  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: {
        externalProvider_externalId: { externalProvider: PROVIDER, externalId: t.id },
      },
      create: {
        leagueId: league.id,
        name: t.name,
        market: t.market ?? null,
        abbreviation: t.abbreviation ?? null,
        externalProvider: PROVIDER,
        externalId: t.id,
      },
      update: {
        name: t.name,
        market: t.market ?? null,
        abbreviation: t.abbreviation ?? null,
      },
    });

    let players: ExternalPlayer[];
    try {
      players = await provider.getPlayers(t.id, nbaLeague.id);
    } catch {
      continue;
    }

    for (const p of players) {
      await prisma.player.upsert({
        where: {
          externalProvider_externalId: { externalProvider: PROVIDER, externalId: p.id },
        },
        create: {
          teamId: team.id,
          fullName: p.fullName,
          position: p.position ?? null,
          jerseyNumber: p.jerseyNumber ?? null,
          active: p.active,
          externalProvider: PROVIDER,
          externalId: p.id,
        },
        update: {
          fullName: p.fullName,
          position: p.position ?? null,
          jerseyNumber: p.jerseyNumber ?? null,
          active: p.active,
          teamId: team.id,
        },
      });
      playersProcessed++;
    }
  }

  return NextResponse.json({
    ok: true,
    leagueId: league.id,
    leagueName: league.name,
    teams: teams.length,
    playersProcessed,
    message: `Imported NBA: ${league.name}. ${teams.length} teams, ${playersProcessed} players.`,
  });
}
