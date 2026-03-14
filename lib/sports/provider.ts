import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  LiveGameState,
  NormalizedPlayerGameStat,
  ProviderName,
} from "@/lib/sports/types";
import { getMockSportsProvider } from "@/lib/sports/mock-provider";
import { getSportsDataIOCBBProvider } from "@/lib/sports/sportsdataio/cbb-provider";

export interface SportsProvider {
  name: ProviderName;
  getLeagues(): Promise<ExternalLeague[]>;
  getTeams(leagueId: ExternalLeague["id"]): Promise<ExternalTeam[]>;
  getPlayers(teamId: ExternalTeam["id"]): Promise<ExternalPlayer[]>;
  getSchedule(leagueId: ExternalLeague["id"], range: DateRange): Promise<ExternalGame[]>;
  /** Optional: live player stats and game state for a game. Used by basketball (and future) live ingestion. */
  getLivePlayerStatsForGame?(
    gameId: string
  ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }>;
}

export function getSportsProvider(name: ProviderName = "mock"): SportsProvider {
  switch (name) {
    case "sportsdataio":
      return getSportsDataIOCBBProvider();
    case "mock":
    default:
      return getMockSportsProvider();
  }
}

