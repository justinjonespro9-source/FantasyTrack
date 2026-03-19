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
import { getSportsDataIOUnifiedProvider } from "@/lib/sports/sportsdataio/unified-provider";

export interface SportsProvider {
  name: ProviderName;
  getLeagues(): Promise<ExternalLeague[]>;
  getTeams(leagueId: ExternalLeague["id"]): Promise<ExternalTeam[]>;
  getPlayers(teamId: ExternalTeam["id"], leagueId?: ExternalLeague["id"]): Promise<ExternalPlayer[]>;
  getSchedule(leagueId: ExternalLeague["id"], range: DateRange): Promise<ExternalGame[]>;
  /** Optional: live player stats and game state for a game. leagueId used by unified provider to choose CBB vs NBA. */
  getLivePlayerStatsForGame?(
    gameId: string,
    leagueId?: ExternalLeague["id"]
  ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }>;
}

export function getSportsProvider(name: ProviderName = "mock"): SportsProvider {
  switch (name) {
    case "sportsdataio":
      return getSportsDataIOUnifiedProvider();
    case "mock":
    default:
      return getMockSportsProvider();
  }
}

