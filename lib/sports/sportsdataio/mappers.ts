import type {
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  NormalizedPlayerGameStat,
} from "@/lib/sports/types";
import type { BasketballRawStats } from "@/lib/scoring-config";

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
  const startTime = raw.DateTime ? new Date(raw.DateTime) : new Date(0);
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
