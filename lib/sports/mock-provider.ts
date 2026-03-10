import type {
  DateRange,
  ExternalGame,
  ExternalLeague,
  ExternalPlayer,
  ExternalTeam,
  ProviderName,
} from "@/lib/sports/types";

const PROVIDER_NAME: ProviderName = "mock";

const leagues: ExternalLeague[] = [
  {
    id: "mock-nhl",
    provider: PROVIDER_NAME,
    sport: "HOCKEY",
    code: "NHL",
    name: "Mock National Hockey League",
  },
  {
    id: "mock-nba",
    provider: PROVIDER_NAME,
    sport: "BASKETBALL",
    code: "NBA",
    name: "Mock National Basketball Association",
  },
  {
    id: "mock-mlb",
    provider: PROVIDER_NAME,
    sport: "BASEBALL",
    code: "MLB",
    name: "Mock Major League Baseball",
  },
];

const teams: ExternalTeam[] = [
  // Hockey
  {
    id: "mock-nhl-edm",
    provider: PROVIDER_NAME,
    leagueId: "mock-nhl",
    name: "Oilers",
    market: "Edmonton",
    abbreviation: "EDM",
  },
  {
    id: "mock-nhl-col",
    provider: PROVIDER_NAME,
    leagueId: "mock-nhl",
    name: "Avalanche",
    market: "Colorado",
    abbreviation: "COL",
  },
  // Basketball
  {
    id: "mock-nba-den",
    provider: PROVIDER_NAME,
    leagueId: "mock-nba",
    name: "Nuggets",
    market: "Denver",
    abbreviation: "DEN",
  },
  {
    id: "mock-nba-lal",
    provider: PROVIDER_NAME,
    leagueId: "mock-nba",
    name: "Lakers",
    market: "Los Angeles",
    abbreviation: "LAL",
  },
  // Baseball
  {
    id: "mock-mlb-nyy",
    provider: PROVIDER_NAME,
    leagueId: "mock-mlb",
    name: "Yankees",
    market: "New York",
    abbreviation: "NYY",
  },
  {
    id: "mock-mlb-bos",
    provider: PROVIDER_NAME,
    leagueId: "mock-mlb",
    name: "Red Sox",
    market: "Boston",
    abbreviation: "BOS",
  },
];

const players: ExternalPlayer[] = [
  // Hockey
  {
    id: "mock-player-mcdavid",
    provider: PROVIDER_NAME,
    teamId: "mock-nhl-edm",
    fullName: "Connor McDavid",
    position: "C",
    jerseyNumber: 97,
    active: true,
  },
  {
    id: "mock-player-mackinnon",
    provider: PROVIDER_NAME,
    teamId: "mock-nhl-col",
    fullName: "Nathan MacKinnon",
    position: "C",
    jerseyNumber: 29,
    active: true,
  },
  // Basketball
  {
    id: "mock-player-jokic",
    provider: PROVIDER_NAME,
    teamId: "mock-nba-den",
    fullName: "Nikola Jokić",
    position: "C",
    jerseyNumber: 15,
    active: true,
  },
  {
    id: "mock-player-james",
    provider: PROVIDER_NAME,
    teamId: "mock-nba-lal",
    fullName: "LeBron James",
    position: "F",
    jerseyNumber: 23,
    active: true,
  },
  // Baseball
  {
    id: "mock-player-judge",
    provider: PROVIDER_NAME,
    teamId: "mock-mlb-nyy",
    fullName: "Aaron Judge",
    position: "OF",
    jerseyNumber: 99,
    active: true,
  },
  {
    id: "mock-player-devers",
    provider: PROVIDER_NAME,
    teamId: "mock-mlb-bos",
    fullName: "Rafael Devers",
    position: "3B",
    jerseyNumber: 11,
    active: true,
  },
];

const games: ExternalGame[] = [
  {
    id: "mock-game-nhl-1",
    provider: PROVIDER_NAME,
    leagueId: "mock-nhl",
    homeTeamId: "mock-nhl-edm",
    awayTeamId: "mock-nhl-col",
    startTime: new Date(),
  },
  {
    id: "mock-game-nba-1",
    provider: PROVIDER_NAME,
    leagueId: "mock-nba",
    homeTeamId: "mock-nba-den",
    awayTeamId: "mock-nba-lal",
    startTime: new Date(),
  },
  {
    id: "mock-game-mlb-1",
    provider: PROVIDER_NAME,
    leagueId: "mock-mlb",
    homeTeamId: "mock-mlb-nyy",
    awayTeamId: "mock-mlb-bos",
    startTime: new Date(),
  },
];

export function getMockSportsProvider() {
  return {
    name: PROVIDER_NAME,
    async getLeagues(): Promise<ExternalLeague[]> {
      return leagues;
    },
    async getTeams(leagueId: ExternalLeague["id"]): Promise<ExternalTeam[]> {
      return teams.filter((t) => t.leagueId === leagueId);
    },
    async getPlayers(teamId: ExternalTeam["id"]): Promise<ExternalPlayer[]> {
      return players.filter((p) => p.teamId === teamId);
    },
    async getSchedule(
      leagueId: ExternalLeague["id"],
      range: DateRange
    ): Promise<ExternalGame[]> {
      const start = range.start.getTime();
      const end = range.end.getTime();
      return games.filter(
        (g) =>
          g.leagueId === leagueId &&
          g.startTime.getTime() >= start &&
          g.startTime.getTime() <= end
      );
    },
  };
}

