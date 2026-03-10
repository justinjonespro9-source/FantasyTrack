import { prisma } from "@/lib/prisma";
import { getSportsProvider } from "@/lib/sports/provider";
import type { ExternalLeague, ExternalTeam, ExternalPlayer } from "@/lib/sports/types";

const PROVIDER = "mock" as const;

async function upsertLeague(league: ExternalLeague) {
  const existing = await prisma.league.findUnique({
    where: {
      externalProvider_externalId: {
        externalProvider: league.provider,
        externalId: league.id,
      },
    },
  });

  if (existing) return existing;

  return prisma.league.create({
    data: {
      name: league.name,
      sport: league.sport,
      code: league.code,
      externalProvider: league.provider,
      externalId: league.id,
    },
  });
}

async function upsertTeam(team: ExternalTeam, leagueDbId: string) {
  const existing = await prisma.team.findUnique({
    where: {
      externalProvider_externalId: {
        externalProvider: team.provider,
        externalId: team.id,
      },
    },
  });

  if (existing) return existing;

  return prisma.team.create({
    data: {
      leagueId: leagueDbId,
      name: team.name,
      market: team.market ?? null,
      abbreviation: team.abbreviation ?? null,
      externalProvider: team.provider,
      externalId: team.id,
    },
  });
}

async function upsertPlayer(player: ExternalPlayer, teamDbId: string) {
  const existing = await prisma.player.findUnique({
    where: {
      externalProvider_externalId: {
        externalProvider: player.provider,
        externalId: player.id,
      },
    },
  });

  if (existing) return existing;

  return prisma.player.create({
    data: {
      teamId: teamDbId,
      fullName: player.fullName,
      position: player.position ?? null,
      jerseyNumber: player.jerseyNumber ?? null,
      active: player.active,
      externalProvider: player.provider,
      externalId: player.id,
    },
  });
}

export async function importMockSportsData() {
  const provider = getSportsProvider(PROVIDER);
  const leagues = await provider.getLeagues();

  for (const league of leagues) {
    const dbLeague = await upsertLeague(league);
    const teams = await provider.getTeams(league.id);

    for (const team of teams) {
      const dbTeam = await upsertTeam(team, dbLeague.id);
      const players = await provider.getPlayers(team.id);

      for (const player of players) {
        await upsertPlayer(player, dbTeam.id);
      }
    }
  }
}

