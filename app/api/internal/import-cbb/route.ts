import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSportsProvider } from "@/lib/sports/provider";
import type { ExternalLeague, ExternalPlayer, ExternalTeam } from "@/lib/sports/types";

const PROVIDER = "sportsdataio";

/**
 * POST /api/internal/import-cbb
 *
 * One-time (or re-runnable) import of NCAA basketball league, teams, and players
 * from SportsDataIO CBB.
 *
 * Flow:
 * 1. GET /v3/cbb/scores/JSON/teams → upsert League (cbb) + Teams
 * 2. For each team: GET /v3/cbb/scores/JSON/Players/{team} → upsert Players
 * 3. Players are stored with externalProvider = "sportsdataio", externalId = PlayerID (API)
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
    console.error("Import CBB: getLeagues failed", err);
    return NextResponse.json(
      { error: "Failed to fetch leagues. Is SPORTSDATAIO_API_KEY set?" },
      { status: 502 }
    );
  }

  const cbbLeague = leagues.find((l) => l.id === "cbb" || l.code === "CBB");
  if (!cbbLeague) {
    return NextResponse.json(
      { error: "CBB league not found from provider." },
      { status: 502 }
    );
  }

  const league = await prisma.league.upsert({
    where: {
      externalProvider_externalId: { externalProvider: PROVIDER, externalId: cbbLeague.id },
    },
    create: {
      name: cbbLeague.name,
      sport: cbbLeague.sport,
      code: cbbLeague.code,
      externalProvider: PROVIDER,
      externalId: cbbLeague.id,
    },
    update: {
      name: cbbLeague.name,
      sport: cbbLeague.sport,
      code: cbbLeague.code,
    },
  });

  let teams: ExternalTeam[];
  try {
    teams = await provider.getTeams(cbbLeague.id);
  } catch (err) {
    console.error("Import CBB: getTeams failed", err);
    return NextResponse.json(
      { error: "Failed to fetch teams." },
      { status: 502 }
    );
  }

  let playersProcessed = 0;

  for (const t of teams) {
    // SportsDataIO team keys (e.g. "HOU") collide across leagues (NBA/NCAA).
    // Scope stored Team.externalId by league so upserts can't overwrite across sports.
    const scopedTeamExternalId = `${cbbLeague.id}:${t.id}`;
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
      players = await provider.getPlayers(t.id, cbbLeague.id);
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
          externalId: p.id, // SportsDataIO PlayerID (string)
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
    message: `Imported CBB: ${league.name}. ${teams.length} teams, ${playersProcessed} players.`,
  });
}
