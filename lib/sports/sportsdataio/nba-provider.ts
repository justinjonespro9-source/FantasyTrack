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
  getNBALeague,
  mapNBAGameToExternalGame,
  mapNBAPlayerGameToNormalizedStat,
  mapNBAPlayerToExternalPlayer,
  mapNBATeamToExternalTeam,
  type NBAGameRaw,
  type NBAPlayerGameRaw,
  type NBAPlayerRaw,
  type NBATeamRaw,
} from "./mappers";

const FORMAT = "JSON";

type NBABoxScoreGameRaw = {
  Status?: string | null;
  Period?: string | null;
  GameID?: number | null;
  DateTime?: string | null;
  HomeTeam?: string | null;
  AwayTeam?: string | null;
  HomeTeamID?: number | null;
  AwayTeamID?: number | null;
};

type NBABoxScoreResponse = {
  Game?: NBABoxScoreGameRaw | null;
  PlayerGames?: NBAPlayerGameRaw[] | null;
};

/**
 * NBA game progress: 4 quarters (1–4) + OT. Map to 0–100%.
 * Scheduled/Final same as CBB; InProgress uses quarter.
 */
function nbaGameProgressFromBoxScore(game: NBABoxScoreGameRaw | null | undefined): LiveGameState | null {
  if (!game) return null;
  const status = (game.Status ?? "").trim();
  const period = (game.Period ?? "").trim() || null;
  if (!status) return null;
  const normalizedStatus = status.toLowerCase();
  if (
    normalizedStatus === "scheduled" ||
    normalizedStatus === "postponed" ||
    normalizedStatus === "delayed" ||
    normalizedStatus === "canceled"
  ) {
    return { status, period, progressPercent: 0 };
  }
  if (
    normalizedStatus === "final" ||
    normalizedStatus === "f/ot" ||
    normalizedStatus === "forfeit" ||
    normalizedStatus === "suspended"
  ) {
    return { status, period, progressPercent: 100 };
  }
  if (normalizedStatus === "inprogress") {
    const p = (period ?? "").toLowerCase();
    if (p === "1" || p === "1st") return { status, period, progressPercent: 25 };
    if (p === "2" || p === "2nd") return { status, period, progressPercent: 50 };
    if (p === "3" || p === "3rd") return { status, period, progressPercent: 75 };
    if (p === "4" || p === "4th") return { status, period, progressPercent: 90 };
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

function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();
  return `${y}-${m}-${day}`;
}

/** Numeric team ID → team key (e.g. "1610612747" → "LAL") for resolving GamesByDate team ids to DB externalId. */
export async function getNBATeamIdMap(): Promise<Record<string, string>> {
  const path = `v3/nba/scores/${FORMAT}/teams`;
  const data = (await sportsDataIOGet<NBATeamRaw[]>({ path })) ?? [];
  const list = Array.isArray(data) ? data : [];
  const map: Record<string, string> = {};
  for (const t of list) {
    const numId = t.TeamID != null ? String(t.TeamID) : "";
    const key = (t.Key ?? numId).trim() || numId;
    if (numId && key) map[numId] = key;
  }
  return map;
}

export function getSportsDataIONBAProvider(): {
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
      return [getNBALeague()];
    },

    async getTeams(): Promise<ExternalTeam[]> {
      const path = `v3/nba/scores/${FORMAT}/teams`;
      const data = (await sportsDataIOGet<NBATeamRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map(mapNBATeamToExternalTeam);
    },

    async getPlayers(teamId: string): Promise<ExternalPlayer[]> {
      const path = `v3/nba/scores/${FORMAT}/Players/${encodeURIComponent(teamId)}`;
      const data = (await sportsDataIOGet<NBAPlayerRaw[]>({ path })) ?? [];
      const list = Array.isArray(data) ? data : [];
      return list.map((p) => mapNBAPlayerToExternalPlayer(p, teamId));
    },

    async getSchedule(_leagueId: string, range: DateRange): Promise<ExternalGame[]> {
      const dates = datesBetween(range.start, range.end);
      const all: ExternalGame[] = [];
      for (const date of dates) {
        const dateStr = formatDateForAPI(date);
        const path = `v3/nba/scores/${FORMAT}/GamesByDate/${dateStr}`;
        try {
          const data = (await sportsDataIOGet<NBAGameRaw[]>({ path })) ?? [];
          const list = Array.isArray(data) ? data : [];
          for (const g of list) {
            all.push(mapNBAGameToExternalGame(g));
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
      const path = `v3/nba/stats/${FORMAT}/BoxScore/${encodeURIComponent(gameId)}`;
      const data = (await sportsDataIOGet<NBABoxScoreResponse>({ path })) ?? {};
      const playerGames = data.PlayerGames ?? [];
      const list = Array.isArray(playerGames) ? playerGames : [];
      const stats = list.map(mapNBAPlayerGameToNormalizedStat);
      const gameState = nbaGameProgressFromBoxScore(data.Game ?? null);
      return { stats, gameState };
    },
  };
}
