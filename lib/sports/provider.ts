import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  ProviderName,
} from "@/lib/sports/types";
import { getMockSportsProvider } from "@/lib/sports/mock-provider";

export interface SportsProvider {
  name: ProviderName;
  getLeagues(): Promise<ExternalLeague[]>;
  getTeams(leagueId: ExternalLeague["id"]): Promise<ExternalTeam[]>;
  getPlayers(teamId: ExternalTeam["id"]): Promise<ExternalPlayer[]>;
  getSchedule(leagueId: ExternalLeague["id"], range: DateRange): Promise<ExternalGame[]>;
}

export function getSportsProvider(name: ProviderName = "mock"): SportsProvider {
  switch (name) {
    case "mock":
    default:
      return getMockSportsProvider();
  }
}

