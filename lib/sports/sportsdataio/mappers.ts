import type {
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  NormalizedPlayerGameStat,
} from "@/lib/sports/types";
import type { BasketballRawStats, HockeyRawStats } from "@/lib/scoring-config";
import { DateTime } from "luxon";

const PROVIDER = "sportsdataio" as const;

/** Minimal CBB API shapes - only fields we map. Provider-specific names stay here. */

export type CBBTeamRaw = {
  TeamID?: number | null;
  Key?: string | null;
  School?: string | null;
  Name?: string | null;
  Active?: boolean;
};

export type CBBPlayerRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  Name?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Position?: string | null;
  Jersey?: number | null;
};

export type CBBGameRaw = {
  GameID?: number | null;
  DateTime?: string | null;
  HomeTeam?: string | null;
  AwayTeam?: string | null;
  HomeTeamID?: number | null;
  AwayTeamID?: number | null;
};

export type CBBPlayerGameRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  GameID?: number | null;
  Name?: string | null;
  Points?: number | null;
  Rebounds?: number | null;
  Assists?: number | null;
  Steals?: number | null;
  BlockedShots?: number | null;
  Turnovers?: number | null;
  ThreePointersMade?: number | null;
};

function toExternalId(value: number | string | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

/**
 * SportsDataIO CBB Game.DateTime is documented as US Eastern local time (no offset).
 * Using `new Date(raw.DateTime)` would treat the string as local time in whatever
 * environment is running the code, which can shift the actual instant by several hours.
 *
 * Instead, we:
 * - Parse the ISO-like string explicitly in the America/New_York time zone.
 * - Convert to UTC and return a JS Date, which Prisma/Postgres store as UTC.
 */
function parseSportsDataIOCbbDateTime(dateTime: string | null | undefined): Date {
  if (!dateTime) return new Date(0);

  const dt = DateTime.fromISO(dateTime, { zone: "America/New_York" });
  if (!dt.isValid) {
    return new Date(0);
  }
  return dt.toUTC().toJSDate();
}

export function mapCBBTeamToExternalTeam(raw: CBBTeamRaw): ExternalTeam {
  const id = (raw.Key ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);
  const name = (raw.Name ?? raw.School ?? "Unknown").trim();
  const market = (raw.School ?? undefined)?.trim();
  return {
    id,
    provider: PROVIDER,
    leagueId: "cbb", // single league for Phase 1
    name,
    market,
    abbreviation: raw.Key ?? undefined,
  };
}

function toPlayerFullName(raw: CBBPlayerRaw): string {
  const combined =
    (raw.Name ?? "").trim() ||
    [raw.FirstName, raw.LastName].filter(Boolean).join(" ").trim();
  return combined || "Unknown";
}

export function mapCBBPlayerToExternalPlayer(raw: CBBPlayerRaw, teamKey: string): ExternalPlayer {
  const id = toExternalId(raw.PlayerID);
  return {
    id,
    provider: PROVIDER,
    teamId: teamKey,
    fullName: toPlayerFullName(raw),
    position: raw.Position ?? undefined,
    jerseyNumber: raw.Jersey ?? undefined,
    active: true,
  };
}

export function mapCBBGameToExternalGame(raw: CBBGameRaw): ExternalGame {
  const id = toExternalId(raw.GameID);
  const homeKey = (raw.HomeTeam ?? toExternalId(raw.HomeTeamID)).trim();
  const awayKey = (raw.AwayTeam ?? toExternalId(raw.AwayTeamID)).trim();
  const startTime = parseSportsDataIOCbbDateTime(raw.DateTime ?? null);
  return {
    id,
    provider: PROVIDER,
    leagueId: "cbb",
    homeTeamId: homeKey,
    awayTeamId: awayKey,
    startTime,
  };
}

/** Map SportsDataIO PlayerGame (box score row) to our normalized stat. */
export function mapCBBPlayerGameToNormalizedStat(raw: CBBPlayerGameRaw): NormalizedPlayerGameStat {
  const playerId = toExternalId(raw.PlayerID);
  const gameId = toExternalId(raw.GameID);
  const teamId = (raw.Team ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);

  const rawStats: BasketballRawStats = {
    points: raw.Points ?? undefined,
    rebounds: raw.Rebounds ?? undefined,
    assists: raw.Assists ?? undefined,
    steals: raw.Steals ?? undefined,
    blocks: raw.BlockedShots ?? undefined,
    turnovers: raw.Turnovers ?? undefined,
    threePointersMade: raw.ThreePointersMade ?? undefined,
  };

  return {
    playerId,
    gameId,
    teamId,
    rawStats,
  };
}

/** Single CBB league for Phase 1 (NCAA basketball). */
export function getCBBLeague(): ExternalLeague {
  return {
    id: "cbb",
    provider: PROVIDER,
    sport: "BASKETBALL",
    code: "CBB",
    name: "NCAA Basketball",
  };
}

// ---------------------------------------------------------------------------
// NBA (SportsDataIO v3/nba) – same provider, leagueId "nba"
// ---------------------------------------------------------------------------

/** Minimal NBA API shapes – only fields we map. Same conventions as CBB; NBA uses City instead of School. */
export type NBATeamRaw = {
  TeamID?: number | null;
  Key?: string | null;
  City?: string | null;
  Name?: string | null;
  Active?: boolean;
};

export type NBAPlayerRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  Name?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Position?: string | null;
  Jersey?: number | null;
};

export type NBAGameRaw = {
  GameID?: number | null;
  DateTime?: string | null;
  HomeTeam?: string | null;
  AwayTeam?: string | null;
  HomeTeamID?: number | null;
  AwayTeamID?: number | null;
};

export type NBAPlayerGameRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  GameID?: number | null;
  Name?: string | null;
  Points?: number | null;
  Rebounds?: number | null;
  Assists?: number | null;
  Steals?: number | null;
  BlockedShots?: number | null;
  Turnovers?: number | null;
  ThreePointersMade?: number | null;
};

/**
 * Parse SportsDataIO game DateTime (US Eastern) to UTC Date.
 * Reused for both CBB and NBA so contest lock times are correct.
 */
export function parseSportsDataIODateTimeEastern(dateTime: string | null | undefined): Date {
  if (!dateTime) return new Date(0);
  const dt = DateTime.fromISO(dateTime, { zone: "America/New_York" });
  if (!dt.isValid) return new Date(0);
  return dt.toUTC().toJSDate();
}

export function mapNBATeamToExternalTeam(raw: NBATeamRaw): ExternalTeam {
  const id = (raw.Key ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);
  const name = (raw.Name ?? "Unknown").trim();
  const market = (raw.City ?? undefined)?.trim();
  return {
    id,
    provider: PROVIDER,
    leagueId: "nba",
    name,
    market,
    abbreviation: raw.Key ?? undefined,
  };
}

function toNBAPlayerFullName(raw: NBAPlayerRaw): string {
  const combined =
    (raw.Name ?? "").trim() ||
    [raw.FirstName, raw.LastName].filter(Boolean).join(" ").trim();
  return combined || "Unknown";
}

export function mapNBAPlayerToExternalPlayer(raw: NBAPlayerRaw, teamKey: string): ExternalPlayer {
  const id = toExternalId(raw.PlayerID);
  return {
    id,
    provider: PROVIDER,
    teamId: teamKey,
    fullName: toNBAPlayerFullName(raw),
    position: raw.Position ?? undefined,
    jerseyNumber: raw.Jersey ?? undefined,
    active: true,
  };
}

export function mapNBAGameToExternalGame(raw: NBAGameRaw): ExternalGame {
  const id = toExternalId(raw.GameID);
  const homeKey = (raw.HomeTeam ?? toExternalId(raw.HomeTeamID)).trim();
  const awayKey = (raw.AwayTeam ?? toExternalId(raw.AwayTeamID)).trim();
  const startTime = parseSportsDataIODateTimeEastern(raw.DateTime ?? null);
  return {
    id,
    provider: PROVIDER,
    leagueId: "nba",
    homeTeamId: homeKey,
    awayTeamId: awayKey,
    startTime,
  };
}

export function mapNBAPlayerGameToNormalizedStat(raw: NBAPlayerGameRaw): NormalizedPlayerGameStat {
  const playerId = toExternalId(raw.PlayerID);
  const gameId = toExternalId(raw.GameID);
  const teamId = (raw.Team ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);
  const rawStats: BasketballRawStats = {
    points: raw.Points ?? undefined,
    rebounds: raw.Rebounds ?? undefined,
    assists: raw.Assists ?? undefined,
    steals: raw.Steals ?? undefined,
    blocks: raw.BlockedShots ?? undefined,
    turnovers: raw.Turnovers ?? undefined,
    threePointersMade: raw.ThreePointersMade ?? undefined,
  };
  return { playerId, gameId, teamId, rawStats };
}

export function getNBALeague(): ExternalLeague {
  return {
    id: "nba",
    provider: PROVIDER,
    sport: "BASKETBALL",
    code: "NBA",
    name: "NBA",
  };
}

// ---------------------------------------------------------------------------
// NHL (SportsDataIO v3/nhl)
// ---------------------------------------------------------------------------

export type NHLTeamRaw = {
  TeamID?: number | null;
  Key?: string | null;
  City?: string | null;
  Name?: string | null;
  Active?: boolean;
};

export type NHLPlayerRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  Name?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Position?: string | null;
  Jersey?: number | null;
};

export type NHLGameRaw = {
  GameID?: number | null;
  DateTime?: string | null;
  HomeTeam?: string | null;
  AwayTeam?: string | null;
  HomeTeamID?: number | null;
  AwayTeamID?: number | null;
  Status?: string | null;
  Period?: string | null;
};

export type NHLPlayerGameRaw = {
  PlayerID?: number | null;
  TeamID?: number | null;
  Team?: string | null;
  GameID?: number | null;
  Name?: string | null;
  // Skater stats
  Goals?: number | null;
  Assists?: number | null;
  ShortHandedGoals?: number | null;
  ShortHandedAssists?: number | null;
  ShotsOnGoal?: number | null;
  ShootoutGoals?: number | null;
  BlockedShots?: number | null;
  // Goalie stats
  Saves?: number | null;
  GoalsAgainst?: number | null;
  Shutout?: number | null;
  Wins?: number | null;
  GoaltendingDecision?: string | null;
  Decision?: string | null;
  OvertimeLosses?: number | null;
};

function deriveNhlGoalieWins(raw: NHLPlayerGameRaw): number | undefined {
  if (typeof raw.Wins === "number" && Number.isFinite(raw.Wins)) {
    return raw.Wins;
  }

  // Fallback: some feeds expose only a decision marker for goalie rows.
  const decision = String(raw.GoaltendingDecision ?? raw.Decision ?? "")
    .trim()
    .toUpperCase();
  if (decision === "W" || decision === "WIN") {
    return 1;
  }

  return undefined;
}

export function getNHLLeague(): ExternalLeague {
  return {
    id: "nhl",
    provider: PROVIDER,
    sport: "HOCKEY",
    code: "NHL",
    name: "National Hockey League",
  };
}

export function mapNHLTeamToExternalTeam(raw: NHLTeamRaw): ExternalTeam {
  const id = (raw.Key ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);
  const name = (raw.Name ?? "Unknown").trim();
  const market = (raw.City ?? undefined)?.trim();
  return {
    id,
    provider: PROVIDER,
    leagueId: "nhl",
    name,
    market,
    abbreviation: raw.Key ?? undefined,
  };
}

function toNHLPlayerFullName(raw: NHLPlayerRaw): string {
  const combined =
    (raw.Name ?? "").trim() ||
    [raw.FirstName, raw.LastName].filter(Boolean).join(" ").trim();
  return combined || "Unknown";
}

export function mapNHLPlayerToExternalPlayer(raw: NHLPlayerRaw, teamKey: string): ExternalPlayer {
  const id = toExternalId(raw.PlayerID);
  return {
    id,
    provider: PROVIDER,
    teamId: teamKey,
    fullName: toNHLPlayerFullName(raw),
    position: raw.Position ?? undefined,
    jerseyNumber: raw.Jersey ?? undefined,
    active: true,
  };
}

export function mapNHLGameToExternalGame(raw: NHLGameRaw): ExternalGame {
  const id = toExternalId(raw.GameID);
  const homeKey = (raw.HomeTeam ?? toExternalId(raw.HomeTeamID)).trim();
  const awayKey = (raw.AwayTeam ?? toExternalId(raw.AwayTeamID)).trim();
  const startTime = parseSportsDataIODateTimeEastern(raw.DateTime ?? null);
  return {
    id,
    provider: PROVIDER,
    leagueId: "nhl",
    homeTeamId: homeKey,
    awayTeamId: awayKey,
    startTime,
  };
}

export function mapNHLPlayerGameToNormalizedStat(raw: NHLPlayerGameRaw): NormalizedPlayerGameStat {
  const playerId = toExternalId(raw.PlayerID);
  const gameId = toExternalId(raw.GameID);
  const teamId = (raw.Team ?? toExternalId(raw.TeamID)).trim() || toExternalId(raw.TeamID);

  const rawStats: HockeyRawStats = {
    goals: raw.Goals ?? undefined,
    assists: raw.Assists ?? undefined,
    shortHandedGoals: raw.ShortHandedGoals ?? undefined,
    shortHandedAssists: raw.ShortHandedAssists ?? undefined,
    shotsOnGoal: raw.ShotsOnGoal ?? undefined,
    shootoutGoals: raw.ShootoutGoals ?? undefined,
    blockedShots: raw.BlockedShots ?? undefined,
    saves: raw.Saves ?? undefined,
    goalsAgainst: raw.GoalsAgainst ?? undefined,
    shutouts: raw.Shutout ?? undefined,
    wins: deriveNhlGoalieWins(raw),
    overtimeLosses: raw.OvertimeLosses ?? undefined,
  };

  return {
    playerId,
    gameId,
    teamId,
    rawStats,
  };
}

