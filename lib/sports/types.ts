import type { SportKey } from "@/lib/sports";
import type { BasketballRawStats } from "@/lib/scoring-config";

export type ExternalId = string;

export type ProviderName = "mock" | "sportsdataio";

export type DateRange = {
  start: Date;
  end: Date;
};

export type ExternalLeague = {
  id: ExternalId;
  provider: ProviderName;
  sport: SportKey;
  code: string;
  name: string;
};

export type ExternalTeam = {
  id: ExternalId;
  provider: ProviderName;
  leagueId: ExternalId;
  name: string;
  market?: string;
  abbreviation?: string;
};

export type ExternalPlayer = {
  id: ExternalId;
  provider: ProviderName;
  teamId: ExternalId;
  fullName: string;
  position?: string;
  jerseyNumber?: number;
  active: boolean;
};

export type ExternalGame = {
  id: ExternalId;
  provider: ProviderName;
  leagueId: ExternalId;
  homeTeamId: ExternalId;
  awayTeamId: ExternalId;
  startTime: Date;
};

/** Provider-agnostic live stat update for one player in one game. Used by ingestion to update lanes. */
export type NormalizedPlayerGameStat = {
  playerId: ExternalId;
  gameId: ExternalId;
  teamId: ExternalId;
  rawStats: BasketballRawStats;
};

/** Game state from BoxScore (status, period, 0–100 progress). Used for UI progress bar only. */
export type LiveGameState = {
  status: string;
  period: string | null;
  progressPercent: number;
};

