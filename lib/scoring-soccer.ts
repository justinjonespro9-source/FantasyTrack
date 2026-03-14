export type SoccerLiveStats =
  | import("./scoring-config").SoccerOutfieldRawStats
  | import("./scoring-config").SoccerGoalkeeperRawStats;

export {
  computeSoccerOutfieldFantasyPointsFromRaw,
  computeSoccerGoalkeeperFantasyPointsFromRaw,
} from "./scoring-config";


