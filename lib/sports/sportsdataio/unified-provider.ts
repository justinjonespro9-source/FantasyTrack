import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  LiveGameState,
  NormalizedPlayerGameStat,
} from "@/lib/sports/types";
import { getSportsDataIOCBBProvider } from "@/lib/sports/sportsdataio/cbb-provider";
import { getSportsDataIONBAProvider } from "@/lib/sports/sportsdataio/nba-provider";
import { getSportsDataIONHLProvider } from "@/lib/sports/sportsdataio/nhl-provider";
import { getCBBLeague, getNBALeague, getNHLLeague } from "@/lib/sports/sportsdataio/mappers";

const CBB_LEAGUE_ID = "cbb";
const NBA_LEAGUE_ID = "nba";
const NHL_LEAGUE_ID = "nhl";

/**
 * Unified SportsDataIO provider: CBB + NBA.
 * getLeagues() returns both; getTeams/getSchedule/getPlayers/getLivePlayerStatsForGame route by leagueId.
 */
export function getSportsDataIOUnifiedProvider(): {
  name: "sportsdataio";
  getLeagues(): Promise<ExternalLeague[]>;
  getTeams(leagueId: string): Promise<ExternalTeam[]>;
  getPlayers(teamId: string, leagueId?: string): Promise<ExternalPlayer[]>;
  getSchedule(leagueId: string, range: DateRange): Promise<ExternalGame[]>;
  getLivePlayerStatsForGame(
    gameId: string,
    leagueId?: string
  ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }>;
} {
  const cbb = getSportsDataIOCBBProvider();
  const nba = getSportsDataIONBAProvider();
  const nhl = getSportsDataIONHLProvider();

  return {
    name: "sportsdataio",

    async getLeagues(): Promise<ExternalLeague[]> {
      return [getCBBLeague(), getNBALeague(), getNHLLeague()];
    },

    async getTeams(leagueId: string): Promise<ExternalTeam[]> {
      if (leagueId === NBA_LEAGUE_ID) return nba.getTeams(leagueId);
      if (leagueId === NHL_LEAGUE_ID) return nhl.getTeams(leagueId);
      return cbb.getTeams(leagueId);
    },

    async getPlayers(teamId: string, leagueId?: string): Promise<ExternalPlayer[]> {
      if (leagueId === NBA_LEAGUE_ID) return nba.getPlayers(teamId);
      if (leagueId === NHL_LEAGUE_ID) return nhl.getPlayers(teamId);
      return cbb.getPlayers(teamId);
    },

    async getSchedule(leagueId: string, range: DateRange): Promise<ExternalGame[]> {
      if (leagueId === NBA_LEAGUE_ID) return nba.getSchedule(leagueId, range);
      if (leagueId === NHL_LEAGUE_ID) return nhl.getSchedule(leagueId, range);
      return cbb.getSchedule(leagueId, range);
    },

    async getLivePlayerStatsForGame(
      gameId: string,
      leagueId?: string
    ): Promise<{ stats: NormalizedPlayerGameStat[]; gameState: LiveGameState | null }> {
      if (leagueId === NBA_LEAGUE_ID) return nba.getLivePlayerStatsForGame(gameId);
      if (leagueId === NHL_LEAGUE_ID) return nhl.getLivePlayerStatsForGame(gameId);
      return cbb.getLivePlayerStatsForGame(gameId);
    },
  };
}
