import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSportsProvider } from "@/lib/sports/provider";
import type { ExternalLeague, ExternalPlayer, ExternalTeam } from "@/lib/sports/types";

const PROVIDER = "sportsdataio";

/**
 * POST /api/internal/import-nhl
 *
 * One-time (or re-runnable) import of NHL league, teams, and players
 * from SportsDataIO NHL.
 *
 * Flow:
 * 1. getLeagues() → find NHL league → upsert League (nhl, sport HOCKEY) + Teams via getTeams("nhl")
 * 2. For each team: getPlayers(teamId, "nhl") → upsert Players
 *
 * League is created with externalProvider=sportsdataio, externalId=nhl so that
 * contest-from-game schedule and hockey live-stats routing work.
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
    console.error("Import NHL: getLeagues failed", err);
    return NextResponse.json(
      { error: "Failed to fetch leagues. Is SPORTSDATAIO_API_KEY set?" },
      { status: 502 }
    );
  }

  const nhlLeague = leagues.find((l) => l.id === "nhl" || l.code === "NHL");
  if (!nhlLeague) {
    return NextResponse.json(
      { error: "NHL league not found from provider." },
      { status: 502 }
    );
  }

  const league = await prisma.league.upsert({
    where: {
      externalProvider_externalId: { externalProvider: PROVIDER, externalId: nhlLeague.id },
    },
    create: {
      name: nhlLeague.name,
      sport: nhlLeague.sport,
      code: nhlLeague.code,
      externalProvider: PROVIDER,
      externalId: nhlLeague.id,
    },
    update: {
      name: nhlLeague.name,
      sport: nhlLeague.sport,
      code: nhlLeague.code,
    },
  });

  let teams: ExternalTeam[];
  try {
    teams = await provider.getTeams(nhlLeague.id);
  } catch (err) {
    console.error("Import NHL: getTeams failed", err);
    return NextResponse.json(
      { error: "Failed to fetch teams." },
      { status: 502 }
    );
  }

  let playersProcessed = 0;

  for (const t of teams) {
    // SportsDataIO team keys (e.g. "HOU") collide across leagues (NBA/NCAA).
    // Scope stored Team.externalId by league so upserts can't overwrite across sports.
    const scopedTeamExternalId = `${nhlLeague.id}:${t.id}`;
    const team = await prisma.team.upsert({
      where: {
        externalProvider_externalId: {
          externalProvider: PROVIDER,
          externalId: scopedTeamExternalId,
        },
      },
      create: {
        leagueId: league.id,
        name: t.name,
        market: t.market ?? null,
        abbreviation: t.abbreviation ?? null,
        externalProvider: PROVIDER,
        externalId: scopedTeamExternalId,
      },
      update: {
        name: t.name,
        market: t.market ?? null,
        abbreviation: t.abbreviation ?? null,
      },
    });

    let players: ExternalPlayer[];
    try {
      players = await provider.getPlayers(t.id, nhlLeague.id);
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
    message: `Imported NHL: ${league.name}. ${teams.length} teams, ${playersProcessed} players.`,
  });
}
