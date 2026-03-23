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
const NHL_REGULATION_PERIODS = 3;
const NHL_PERIOD_SECONDS = 20 * 60;
const NHL_REGULATION_SECONDS = NHL_REGULATION_PERIODS * NHL_PERIOD_SECONDS;

type NHLBoxScoreGameRaw = NHLGameRaw & {
  Clock?: string | null;
  TimeRemaining?: string | null;
  TimeRemainingMinutes?: number | null;
  TimeRemainingSeconds?: number | null;
  SecondsRemaining?: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseClockToSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length === 2) {
    const mm = Number(parts[0]);
    const ss = Number(parts[1]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return clamp(mm * 60 + ss, 0, NHL_PERIOD_SECONDS);
  }
  if (parts.length === 3) {
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return clamp(hh * 3600 + mm * 60 + ss, 0, NHL_PERIOD_SECONDS);
  }
  return null;
}

function parsePeriodNumber(period: string | null | undefined): number | null {
  const p = String(period ?? "").trim().toLowerCase();
  if (!p) return null;
  if (p === "ot" || p.startsWith("ot")) return 4;
  if (p === "so" || p.includes("shootout")) return 5;

  const digits = p.match(/\d+/)?.[0];
  if (!digits) return null;
  const num = Number(digits);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * NHL game progress: 3 regulation periods + OT/SO handling.
 * Prefer period + time-remaining fields when available; otherwise fallback to period anchors.
 */
function nhlGameProgressFromBoxScore(game: NHLBoxScoreGameRaw | null | undefined): LiveGameState | null {
  if (!game) return null;
  const status = (game.Status ?? "").trim();
  const period = (game.Period ?? "").trim() || null;
  if (!status) return null;

  const normalizedStatus = status.toLowerCase();
  if (
    normalizedStatus === "scheduled" ||
    normalizedStatus === "pregame" ||
    normalizedStatus === "postponed" ||
    normalizedStatus === "delayed" ||
    normalizedStatus === "canceled"
  ) {
    return { status, period, progressPercent: 0 };
  }
  if (
    normalizedStatus === "final" ||
    normalizedStatus === "forfeit" ||
    normalizedStatus === "suspended"
  ) {
    return { status, period, progressPercent: 100 };
  }

  const periodNum = parsePeriodNumber(period);
  const remainingFromClock =
    parseClockToSeconds(game.TimeRemaining) ??
    parseClockToSeconds(game.Clock) ??
    (typeof game.SecondsRemaining === "number"
      // SportsDataIO exposes SecondsRemaining on several game payloads as total
      // seconds left in the current period.
      ? clamp(game.SecondsRemaining, 0, NHL_PERIOD_SECONDS)
      : null);

  if (normalizedStatus === "inprogress") {
    if (periodNum != null && periodNum <= NHL_REGULATION_PERIODS && remainingFromClock != null) {
      const regulationCompletedSeconds = (periodNum - 1) * NHL_PERIOD_SECONDS;
      const elapsedThisPeriod = NHL_PERIOD_SECONDS - remainingFromClock;
      const elapsedRegulationSeconds = regulationCompletedSeconds + elapsedThisPeriod;
      const progressPercent = clamp((elapsedRegulationSeconds / NHL_REGULATION_SECONDS) * 100, 0, 90);
      return { status, period, progressPercent };
    }

    if (periodNum != null && periodNum >= 4) {
      if (remainingFromClock != null) {
        const elapsedOtSeconds = NHL_PERIOD_SECONDS - remainingFromClock;
        const otProgress = clamp((elapsedOtSeconds / NHL_PERIOD_SECONDS) * 5, 0, 5);
        return { status, period, progressPercent: 95 + otProgress };
      }
      // OT or SO without clock detail.
      return { status, period, progressPercent: periodNum >= 5 ? 99 : 95 };
    }

    // In-progress fallback when period/clock are missing.
    if (periodNum === 1) return { status, period, progressPercent: 15 };
    if (periodNum === 2) return { status, period, progressPercent: 45 };
    if (periodNum === 3) return { status, period, progressPercent: 75 };
    return { status, period, progressPercent: 10 };
  }

  if (normalizedStatus.includes("intermission")) {
    if (periodNum === 1) return { status, period, progressPercent: 30 };
    if (periodNum === 2) return { status, period, progressPercent: 60 };
    if (periodNum === 3) return { status, period, progressPercent: 90 };
    return { status, period, progressPercent: 95 };
  }

  return { status, period, progressPercent: 0 };
}

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

/** Numeric team ID → team key for resolving GamesByDate team ids to DB externalId. */
export async function getNHLTeamIdMap(): Promise<Record<string, string>> {
  const path = `v3/nhl/scores/${FORMAT}/teams`;
  const data = (await sportsDataIOGet<NHLTeamRaw[]>({ path })) ?? [];
  const list = Array.isArray(data) ? data : [];
  const map: Record<string, string> = {};
  for (const t of list) {
    const numId = t.TeamID != null ? String(t.TeamID) : "";
    const key = (t.Key ?? numId).trim() || numId;
    if (numId && key) map[numId] = key;
  }
  return map;
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
      const gameState = nhlGameProgressFromBoxScore((data.Game ?? null) as NHLBoxScoreGameRaw | null);

      return { stats, gameState };
    },
  };
}

