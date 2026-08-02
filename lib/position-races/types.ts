export const POSITION_RACE_ORDER = ["QB", "RB", "WR", "TE"] as const;
export type PositionRaceKey = (typeof POSITION_RACE_ORDER)[number];

export type LobbyLaneRow = {
  id: string;
  name: string;
  team: string;
  position: string;
  projectedRank: number | null;
  projectedPoints: number | null;
  marketRank: number | null;
  winPoolAmount: number;
  poolSharePct: number | null;
  winMultiple: number | null;
  oddsLabel: string;
  oddsEstablished: boolean;
};

export type PositionRaceCard = {
  contestId: string;
  position: PositionRaceKey;
  title: string;
  headline: string;
  supportingCopy: string | null;
  status: string;
  lifecycleLabel: string;
  startTime: string;
  timeToLockSeconds: number;
  runnerCount: number;
  entryCount: number;
  poolTotal: number;
  winPoolTotal: number;
  hasMeaningfulPool: boolean;
  slateLabel: string | null;
  scoringLabel: string | null;
  topLanes: LobbyLaneRow[];
};

export type FeaturedPlayer = {
  contestId: string;
  position: PositionRaceKey;
  laneId: string;
  name: string;
  team: string;
  oddsLabel: string;
  poolSharePct: number | null;
  projectedRank: number | null;
  winMultiple: number | null;
};

export type MarketSnapshot = {
  mostBacked: FeaturedPlayer | null;
  largestPool: { position: PositionRaceKey; contestId: string; poolTotal: number } | null;
  closestRace: {
    position: PositionRaceKey;
    contestId: string;
    leaderName: string;
    leaderSharePct: number;
    secondName: string;
    secondSharePct: number;
  } | null;
  totalEntries: number;
  earliestLockSeconds: number | null;
};

export type SportRaceListItem = {
  id: string;
  title: string;
  sport: string;
  sportKey: string;
  status: string;
  startTime: string;
  seriesName: string | null;
  bucket: "open" | "upcoming" | "completed";
};

export type PositionRacesLobbyPayload = {
  week: number;
  season: number;
  generatedAt: string;
  featuredSport: string;
  races: PositionRaceCard[];
  totals: {
    activeRaces: number;
    totalEntries: number;
    totalPool: number;
    earliestLockSeconds: number | null;
    earliestLockTime: string | null;
  };
  featuredLongShots: FeaturedPlayer[];
  playersToWatch: FeaturedPlayer[];
  marketSnapshot: MarketSnapshot;
  /** @deprecated Prefer racesBySport — kept for older clients */
  otherContests: Array<{
    id: string;
    title: string;
    sport: string;
    status: string;
    startTime: string;
    seriesName: string | null;
  }>;
  racesBySport: Record<string, SportRaceListItem[]>;
  availableSports: string[];
  movementAvailable: boolean;
};
