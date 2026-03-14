import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  LiveGameState,
  NormalizedPlayerGameStat,
} from "@/lib/sports/types";
import { sportsDataIOGet } from "./client";
import {
  getCBBLeague,
  mapCBBGameToExternalGame,
  mapCBBPlayerGameToNormalizedStat,
  mapCBBPlayerToExternalPlayer,
  mapCBBTeamToExternalTeam,
  type CBBGameRaw,
  type CBBPlayerGameRaw,
  type CBBPlayerRaw,
  type CBBTeamRaw,
} from "./mappers";

const FORMAT = "JSON";

/** CBB BoxScore Game object (can include Status, Period from live/final endpoint). */
type CBBBoxScoreGameRaw = {
  Status?: string | null;
  Period?: string | null;
  GameID?: number | null;
  DateTime?: string | null;
  HomeTeam?: string | null;
  AwayTeam?: string | null;
  HomeTeamID?: number | null;
  AwayTeamID?: number | null;
};

/** CBB Box Score response: Game + PlayerGames array. */
type CBBBoxScoreResponse = {
  Game?: CBBBoxScoreGameRaw | null;
  PlayerGames?: CBBPlayerGameRaw[] | null;
};

/**
 * Convert CBB game status + period into 0–100 progress. CBB has 2 halves (1, Half, 2); OT = 100%.
 * Fallback: missing/invalid state -> 0.
 */
function cbbGameProgressFromBoxScore(game: CBBBoxScoreGameRaw | null | undefined): LiveGameState | null {
  if (!game) return null;
  const status = (game.Status ?? "").trim();
  const period = (game.Period ?? "").trim() || null;

  if (!status) return null;

  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "scheduled" || normalizedStatus === "postponed" || normalizedStatus === "delayed" || normalizedStatus === "canceled") {
    return { status, period, progressPercent: 0 };
  }
  if (normalizedStatus === "final" || normalizedStatus === "f/ot" || normalizedStatus === "forfeit" || normalizedStatus === "suspended") {
    return { status, period, progressPercent: 100 };
  }
  if (normalizedStatus === "inprogress") {
    const p = (period ?? "").toLowerCase();
    if (p === "1") return { status, period, progressPercent: 25 };
    if (p === "half") return { status, period, progressPercent: 50 };
    if (p === "2") return { status, period, progressPercent: 75 };
    if (p === "ot" || p.startsWith("ot")) return { status, period, progressPercent: 100 };
    return { status, period, progressPercent: 25 };
  }
  return { status, period, progressPercent: 0 };
}

function datesBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  while (d <= e) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Date as YYYY-MMM-DD per SportsDataIO (e.g. 2025-MAR-09). */
function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();
  return `${y}-${m}-${day}`;
}

export function getSportsDataIOCBBProvider(): {
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
      return [getCBBLeague()];
    },

    async getTeams(): Promise<ExternalTeam[]> {
      const path = `v3/cbb/scores/${FORMAT}/teams`;
      const data = (await sportsDataIOGet<CBBTeamRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map(mapCBBTeamToExternalTeam);
    },

    async getPlayers(teamId: string): Promise<ExternalPlayer[]> {
      const path = `v3/cbb/scores/${FORMAT}/Players/${encodeURIComponent(teamId)}`;
      const data = (await sportsDataIOGet<CBBPlayerRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map((p) => mapCBBPlayerToExternalPlayer(p, teamId));
    },

    async getSchedule(_leagueId: string, range: DateRange): Promise<ExternalGame[]> {
      const dates = datesBetween(range.start, range.end);
      const all: ExternalGame[] = [];

      for (const date of dates) {
        const dateStr = formatDateForAPI(date);
        const path = `v3/cbb/scores/${FORMAT}/GamesByDate/${dateStr}`;
        try {
          const data = (await sportsDataIOGet<CBBGameRaw[]>({ path })) ?? [];
          const list = Array.isArray(data) ? data : [];
          for (const g of list) {
            all.push(mapCBBGameToExternalGame(g));
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
      const path = `v3/cbb/stats/${FORMAT}/BoxScore/${encodeURIComponent(gameId)}`;
      const data = (await sportsDataIOGet<CBBBoxScoreResponse>({ path })) ?? {};
      const playerGames = data.PlayerGames ?? [];
      const list = Array.isArray(playerGames) ? playerGames : [];
      const stats = list.map(mapCBBPlayerGameToNormalizedStat);
      const gameState = cbbGameProgressFromBoxScore(data.Game ?? null);
      return { stats, gameState };
    },
  };
}
