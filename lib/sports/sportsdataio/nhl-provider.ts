import {
  sportsDataIOGet,
  type SportsDataIORequestOptions,
} from "@/lib/sports/sportsdataio/client";
import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  LiveGameState,
  NormalizedPlayerGameStat,
} from "@/lib/sports/types";
import {
  getNHLLeague,
  mapNHLGameToExternalGame,
  mapNHLPlayerGameToNormalizedStat,
  mapNHLPlayerToExternalPlayer,
  mapNHLTeamToExternalTeam,
  type NHLGameRaw,
  type NHLPlayerGameRaw,
  type NHLPlayerRaw,
  type NHLTeamRaw,
} from "@/lib/sports/sportsdataio/mappers";

const FORMAT = "JSON";

function datesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();
  return `${y}-${m}-${day}`;
}

export function getSportsDataIONHLProvider(): {
  name: "sportsdataio";
  getLeagues(): Promise<ExternalLeague[]>;
  getTeams(leagueId: string): Promise<ExternalTeam[]>;
  getPlayers(teamId: string): Promise<ExternalPlayer[]>;
  getSchedule(leagueId: string, range: DateRange): Promise<ExternalGame[]>;
  getLivePlayerStatsForGame(
    gameId: string
  ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }>;
} {
  return {
    name: "sportsdataio",

    async getLeagues(): Promise<ExternalLeague[]> {
      return [getNHLLeague()];
    },

    async getTeams(): Promise<ExternalTeam[]> {
      const path = `v3/nhl/scores/${FORMAT}/teams`;
      const data = (await sportsDataIOGet<NHLTeamRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map(mapNHLTeamToExternalTeam);
    },

    async getPlayers(teamId: string): Promise<ExternalPlayer[]> {
      const path = `v3/nhl/scores/${FORMAT}/Players/${encodeURIComponent(teamId)}`;
      const data = (await sportsDataIOGet<NHLPlayerRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map((p) => mapNHLPlayerToExternalPlayer(p, teamId));
    },

    async getSchedule(_leagueId: string, range: DateRange): Promise<ExternalGame[]> {
      const dates = datesBetween(range.start, range.end);
      const all: ExternalGame[] = [];
      for (const date of dates) {
        const dateStr = formatDateForAPI(date);
        const path = `v3/nhl/scores/${FORMAT}/GamesByDate/${dateStr}`;
        try {
          const data = (await sportsDataIOGet<NHLGameRaw[]>({ path })) ?? [];
          const list = Array.isArray(data) ? data : [];
          for (const g of list) {
            all.push(mapNHLGameToExternalGame(g));
          }
        } catch {
          // Skip days with no games or API error
        }
      }
      all.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return all;
    },

    async getLivePlayerStatsForGame(
      gameId: string
    ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }> {
      const path = `v3/nhl/stats/${FORMAT}/BoxScore/${encodeURIComponent(gameId)}`;
      const data = (await sportsDataIOGet<{
        Game?: NHLGameRaw | null;
        PlayerGames?: NHLPlayerGameRaw[] | null;
      }>({ path } as SportsDataIORequestOptions)) ?? {};

      const playerGames = data.PlayerGames ?? [];
      const list = Array.isArray(playerGames) ? playerGames : [];
      const stats = list.map(mapNHLPlayerGameToNormalizedStat);

      const gameState: LiveGameState | null = data.Game
        ? {
            status: (data.Game as any).Status ?? "Unknown",
            period: ((data.Game as any).Period ?? null) as string | null,
            // If SportsDataIO exposes a more precise progress, wire it here.
            // For now, conservative fallback: 0 for non-final, 100 for Final.
            progressPercent: ((data.Game as any).Status ?? "").toLowerCase() === "final" ? 100 : 0,
          }
        : null;

      return { stats, gameState };
    },
  };
}

