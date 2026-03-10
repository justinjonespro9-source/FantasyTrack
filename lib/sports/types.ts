import type { SportKey } from "@/lib/sports";

export type ExternalId = string;

export type ProviderName = "mock";

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

