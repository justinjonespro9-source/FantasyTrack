import type { SportKey } from "@/lib/sports";
import type { ScoringRuleSection } from "@/lib/scoring-rules";

/**
 * Centralized, sport-specific scoring configuration and calculators.
 *
 * NOTE: All future admin live scoring UIs and external stat feeds should map
 * provider fields into these raw stat keys. Do not apply bonuses in the UI;
 * they are derived here from raw inputs only.
 */

// ---------- Shared type helpers ----------

export type HockeyRawStats = {
  // Skater
  goals?: number | null;
  assists?: number | null;
  shortHandedGoals?: number | null;
  shortHandedAssists?: number | null;
  shotsOnGoal?: number | null;
  shootoutGoals?: number | null;
  blockedShots?: number | null;
  // Goalie
  saves?: number | null;
  goalsAgainst?: number | null;
  shutouts?: number | null;
  wins?: number | null;
  overtimeLosses?: number | null;
};

export type BasketballRawStats = {
  points?: number | null;
  rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  threePointersMade?: number | null;
};

export type FootballQBRawStats = {
  passingYards?: number | null;
  passingTouchdowns?: number | null;
  interceptionsThrown?: number | null;
  rushingYards?: number | null;
  rushingTouchdowns?: number | null;
  twoPointConversions?: number | null;
  fumblesLost?: number | null;
};

export type FootballSkillRawStats = {
  rushingYards?: number | null;
  rushingTouchdowns?: number | null;
  receptions?: number | null;
  receivingYards?: number | null;
  receivingTouchdowns?: number | null;
  twoPointConversions?: number | null;
  fumblesLost?: number | null;
};

export type FootballKickerRawStats = {
  extraPointsMade?: number | null;
  fieldGoals0to39?: number | null;
  fieldGoals40to49?: number | null;
  fieldGoals50Plus?: number | null;
  fieldGoalsMissed?: number | null;
};

export type FootballDSTRawStats = {
  sacks?: number | null;
  interceptions?: number | null;
  fumbleRecoveries?: number | null;
  defensiveTouchdowns?: number | null;
  safeties?: number | null;
  blockedKicks?: number | null;
  pointsAllowed?: number | null;
};

export type BaseballHitterRawStats = {
  singles?: number | null;
  doubles?: number | null;
  triples?: number | null;
  homeRuns?: number | null;
  runs?: number | null;
  runsBattedIn?: number | null;
  walks?: number | null;
  stolenBases?: number | null;
  strikeouts?: number | null;
};

export type BaseballPitcherRawStats = {
  inningsPitched?: number | null; // e.g. 6.2 for 6 and 2/3
  strikeouts?: number | null;
  wins?: number | null;
  earnedRuns?: number | null;
  hitsAllowed?: number | null;
  walksAllowed?: number | null;
  saves?: number | null;
  qualityStart?: number | null;
};

export type SoccerOutfieldRawStats = {
  goals?: number | null;
  assists?: number | null;
  shotsOnTarget?: number | null;
  chancesCreated?: number | null;
  crosses?: number | null;
  tacklesWon?: number | null;
  interceptions?: number | null;
  foulsCommitted?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
};

export type SoccerGoalkeeperRawStats = {
  saves?: number | null;
  goalsAllowed?: number | null;
  cleanSheet?: number | null;
  penaltySaves?: number | null;
  wins?: number | null;
};

export type GolfRawStats = {
  birdies?: number | null;
  eagles?: number | null;
  albatrosses?: number | null;
  pars?: number | null;
  bogeys?: number | null;
  doubleBogeyOrWorse?: number | null;
  holeInOnes?: number | null;
  birdieStreaks3Plus?: number | null;
  bogeyFreeRounds?: number | null;
  roundsUnder70?: number | null;
  madeCut?: number | null;
  top10Finish?: number | null;
  wins?: number | null;
};

// ---------- Shared scoring breakdown types ----------

export type ScoringBreakdownRow = {
  key: string;
  label: string;
  rawValue: number;
  fantasyPoints: number;
};

export type ScoringBreakdown = {
  rows: ScoringBreakdownRow[];
  total: number;
};

// ---------- Admin field metadata ----------

export type AdminFieldDef = {
  rawKey: string;
  laneKey: string;
  label: string;
  inputType: "int" | "float";
  step: number;
  quick?: number[];
};

// ---------- Hockey ----------

export const HOCKEY_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Positions: Forward / Defense / Goalie",
    items: [
      "Skater Goal = +8 pts",
      "Skater Assist = +4 pts",
      "Short-handed goal = +2 pts",
      "Short-handed assist = +2 pts",
      "Shot on goal = +1 pt",
      "Shootout goal = +2 pts",
      "Blocked shot = +1 pt",
      "Hat trick (3+ goals) = +5 pts",
      "5+ shots on goal = +3 pts",
      "3+ blocked shots = +3 pts",
    ],
  },
  {
    title: "Eligible Position: Goalie",
    items: [
      "Win = +5 pts",
      "OT Loss = +2 pts",
      "Shutout = +5 pts",
      "Save = +0.7 pts",
      "Goal Against = -3.5 pts",
      "35+ Saves = +3 pts",
    ],
  },
];

export function computeHockeyFantasyPointsFromRaw(raw: HockeyRawStats): number {
  const goals = raw.goals ?? 0;
  const assists = raw.assists ?? 0;
  const shortHandedGoals = raw.shortHandedGoals ?? 0;
  const shortHandedAssists = raw.shortHandedAssists ?? 0;
  const shotsOnGoal = raw.shotsOnGoal ?? 0;
  const shootoutGoals = raw.shootoutGoals ?? 0;
  const blockedShots = raw.blockedShots ?? 0;
  const saves = raw.saves ?? 0;
  const goalsAgainst = raw.goalsAgainst ?? 0;
  const shutouts = raw.shutouts ?? 0;
  const wins = raw.wins ?? 0;
  const overtimeLosses = raw.overtimeLosses ?? 0;

  // Base skater scoring
  let total =
    goals * 8 +
    assists * 4 +
    shortHandedGoals * 2 +
    shortHandedAssists * 2 +
    shotsOnGoal * 1 +
    shootoutGoals * 2 +
    blockedShots * 1;

  // Skater bonuses
  if (goals >= 3) total += 5; // Hat trick
  if (shotsOnGoal >= 5) total += 3; // 5+ SOG
  if (blockedShots >= 3) total += 3; // 3+ blocks

  // Goalie base scoring
  total += saves * 0.7;
  total += goalsAgainst * -3.5;
  total += shutouts * 5;
  total += wins * 5;
  total += overtimeLosses * 2;

  // Goalie bonuses
  if (saves >= 35) total += 3;

  return Number.isFinite(total) ? total : 0;
}

// ---------- Basketball ----------

export const BASKETBALL_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Positions: Guard / Forward / Center",
    items: [
      "Point = +1 pt",
      "3-pointer made = +0.5 pts",
      "Rebound = +1.2 pts",
      "Assist = +1.5 pts",
      "Steal = +3 pts",
      "Block = +3 pts",
      "Turnover = -1 pt",
      "Double-double (2 of points / rebounds / assists / steals / blocks in double figures) = +3 pts",
      "Triple-double (3 of points / rebounds / assists / steals / blocks in double figures) = +5 pts",
    ],
  },
];

export function computeBasketballFantasyPointsFromRaw(raw: BasketballRawStats): number {
  const points = raw.points ?? 0;
  const rebounds = raw.rebounds ?? 0;
  const assists = raw.assists ?? 0;
  const steals = raw.steals ?? 0;
  const blocks = raw.blocks ?? 0;
  const turnovers = raw.turnovers ?? 0;
  const threes = raw.threePointersMade ?? 0;

  let total =
    points * 1 +
    threes * 0.5 +
    rebounds * 1.2 +
    assists * 1.5 +
    steals * 3 +
    blocks * 3 +
    turnovers * -1;

  // Derived bonuses
  const doubleDigitCats =
    (points >= 10 ? 1 : 0) +
    (rebounds >= 10 ? 1 : 0) +
    (assists >= 10 ? 1 : 0) +
    (steals >= 10 ? 1 : 0) +
    (blocks >= 10 ? 1 : 0);

  if (doubleDigitCats >= 2) {
    total += 3; // Double-double
  }
  if (doubleDigitCats >= 3) {
    total += 5; // Triple-double
  }

  return Number.isFinite(total) ? total : 0;
}

export function getBasketballScoringBreakdown(raw: BasketballRawStats): ScoringBreakdown {
  const points = raw.points ?? 0;
  const rebounds = raw.rebounds ?? 0;
  const assists = raw.assists ?? 0;
  const steals = raw.steals ?? 0;
  const blocks = raw.blocks ?? 0;
  const turnovers = raw.turnovers ?? 0;
  const threes = raw.threePointersMade ?? 0;

  const rows: ScoringBreakdownRow[] = [];

  const addRow = (key: string, label: string, count: number, perUnit: number) => {
    if (!count) return;
    rows.push({
      key,
      label,
      rawValue: count,
      fantasyPoints: count * perUnit,
    });
  };

  // Base categories
  addRow("basketball.points", "Points", points, 1);
  addRow("basketball.threes", "3-pointers made", threes, 0.5);
  addRow("basketball.rebounds", "Rebounds", rebounds, 1.2);
  addRow("basketball.assists", "Assists", assists, 1.5);
  addRow("basketball.steals", "Steals", steals, 3);
  addRow("basketball.blocks", "Blocks", blocks, 3);
  addRow("basketball.turnovers", "Turnovers", turnovers, -1);

  // Bonuses (mirror computeBasketballFantasyPointsFromRaw)
  const doubleDigitCats =
    (points >= 10 ? 1 : 0) +
    (rebounds >= 10 ? 1 : 0) +
    (assists >= 10 ? 1 : 0) +
    (steals >= 10 ? 1 : 0) +
    (blocks >= 10 ? 1 : 0);

  if (doubleDigitCats >= 2) {
    rows.push({
      key: "basketball.doubleDouble",
      label: "Double-double bonus",
      rawValue: 1,
      fantasyPoints: 3,
    });
  }
  if (doubleDigitCats >= 3) {
    rows.push({
      key: "basketball.tripleDouble",
      label: "Triple-double bonus",
      rawValue: 1,
      fantasyPoints: 5,
    });
  }

  const total = rows.reduce((sum, row) => sum + row.fantasyPoints, 0);

  return { rows, total };
}

// ---------- Football ----------

export const FOOTBALL_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Positions: QB / RB / WR / TE",
    items: [
      "Passing yards = +0.04 pts/yd",
      "Passing TD = +4 pts",
      "Interception thrown = -2 pts",
      "Rushing yards = +0.1 pts/yd",
      "Rushing TD = +6 pts",
      "Receiving yards = +0.1 pts/yd",
      "Receiving TD = +6 pts",
      "Reception = +1 pt",
      "2-point conversion (pass, run, or catch) = +2 pts",
      "Fumble lost = -2 pts",
      "300+ passing yards (QB) = +3 pts",
      "100+ rushing yards (QB / RB / WR / TE) = +3 pts",
      "100+ receiving yards (RB / WR / TE) = +3 pts",
    ],
  },
  {
    title: "Eligible Position: Kicker",
    items: [
      "Extra point made = +1 pt",
      "Field goal 0–39 yds = +3 pts",
      "Field goal 40–49 yds = +4 pts",
      "Field goal 50+ yds = +5 pts",
      "Field goal missed = -1 pt",
    ],
  },
  {
    title: "Eligible Position: Defense / Special Teams",
    items: [
      "Sack = +1 pt",
      "Interception = +2 pts",
      "Fumble recovery = +2 pts",
      "Defensive TD = +6 pts",
      "Safety = +2 pts",
      "Blocked kick = +2 pts",
      "0 points allowed = +10 pts",
      "1–6 points allowed = +7 pts",
      "7–13 points allowed = +4 pts",
      "14–20 points allowed = +1 pt",
      "21–27 points allowed = 0 pts",
      "28–34 points allowed = -1 pt",
      "35+ points allowed = -4 pts",
    ],
  },
];

export function computeFootballQBFantasyPointsFromRaw(raw: FootballQBRawStats): number {
  const passingYards = raw.passingYards ?? 0;
  const passingTDs = raw.passingTouchdowns ?? 0;
  const interceptions = raw.interceptionsThrown ?? 0;
  const rushingYards = raw.rushingYards ?? 0;
  const rushingTDs = raw.rushingTouchdowns ?? 0;
  const twoPoints = raw.twoPointConversions ?? 0;
  const fumblesLost = raw.fumblesLost ?? 0;

  let total =
    passingYards * 0.04 +
    passingTDs * 4 +
    interceptions * -2 +
    rushingYards * 0.1 +
    rushingTDs * 6 +
    twoPoints * 2 +
    fumblesLost * -2;

  if (passingYards >= 300) total += 3;
  if (rushingYards >= 100) total += 3;

  return Number.isFinite(total) ? total : 0;
}

export function computeFootballSkillFantasyPointsFromRaw(raw: FootballSkillRawStats): number {
  const rushingYards = raw.rushingYards ?? 0;
  const rushingTDs = raw.rushingTouchdowns ?? 0;
  const receptions = raw.receptions ?? 0;
  const receivingYards = raw.receivingYards ?? 0;
  const receivingTDs = raw.receivingTouchdowns ?? 0;
  const twoPoints = raw.twoPointConversions ?? 0;
  const fumblesLost = raw.fumblesLost ?? 0;

  let total =
    rushingYards * 0.1 +
    rushingTDs * 6 +
    receptions * 1 +
    receivingYards * 0.1 +
    receivingTDs * 6 +
    twoPoints * 2 +
    fumblesLost * -2;

  if (rushingYards >= 100) total += 3;
  if (receivingYards >= 100) total += 3;

  return Number.isFinite(total) ? total : 0;
}

export function computeFootballKickerFantasyPointsFromRaw(raw: FootballKickerRawStats): number {
  const xp = raw.extraPointsMade ?? 0;
  const fgShort = raw.fieldGoals0to39 ?? 0;
  const fgMid = raw.fieldGoals40to49 ?? 0;
  const fgLong = raw.fieldGoals50Plus ?? 0;
  const missed = raw.fieldGoalsMissed ?? 0;

  const total =
    xp * 1 +
    fgShort * 3 +
    fgMid * 4 +
    fgLong * 5 +
    missed * -1;

  return Number.isFinite(total) ? total : 0;
}

export function computeFootballDSTFantasyPointsFromRaw(raw: FootballDSTRawStats): number {
  const sacks = raw.sacks ?? 0;
  const interceptions = raw.interceptions ?? 0;
  const fumbles = raw.fumbleRecoveries ?? 0;
  const td = raw.defensiveTouchdowns ?? 0;
  const safeties = raw.safeties ?? 0;
  const blocked = raw.blockedKicks ?? 0;
  const ptsAllowed = raw.pointsAllowed ?? 0;

  let total =
    sacks * 1 +
    interceptions * 2 +
    fumbles * 2 +
    td * 6 +
    safeties * 2 +
    blocked * 2;

  if (ptsAllowed <= 0) total += 10;
  else if (ptsAllowed <= 6) total += 7;
  else if (ptsAllowed <= 13) total += 4;
  else if (ptsAllowed <= 20) total += 1;
  else if (ptsAllowed <= 27) total += 0;
  else if (ptsAllowed <= 34) total += -1;
  else total += -4;

  return Number.isFinite(total) ? total : 0;
}

// ---------- Baseball ----------

export const BASEBALL_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Positions: C / 1B / 2B / 3B / SS / OF / DH",
    items: [
      "Single = +3 pts",
      "Double = +5 pts",
      "Triple = +8 pts",
      "Home run = +10 pts",
      "Run scored = +2 pts",
      "RBI = +2 pts",
      "Walk = +2 pts",
      "Stolen base = +5 pts",
      "Strikeout = -1 pt",
      "3+ hits in a game = +3 pts",
    ],
  },
  {
    title: "Eligible Position: Pitcher",
    items: [
      "Inning pitched = +2.25 pts",
      "Strikeout = +2 pts",
      "Win = +4 pts",
      "Earned run allowed = -2 pts",
      "Hit allowed = -0.6 pts",
      "Walk allowed = -0.6 pts",
      "Save = +5 pts",
      "Quality start = +4 pts",
    ],
  },
];

export function computeBaseballHitterFantasyPointsFromRaw(raw: BaseballHitterRawStats): number {
  const singles = raw.singles ?? 0;
  const doubles = raw.doubles ?? 0;
  const triples = raw.triples ?? 0;
  const homers = raw.homeRuns ?? 0;
  const runs = raw.runs ?? 0;
  const rbi = raw.runsBattedIn ?? 0;
  const walks = raw.walks ?? 0;
  const steals = raw.stolenBases ?? 0;
  const k = raw.strikeouts ?? 0;

  let total =
    singles * 3 +
    doubles * 5 +
    triples * 8 +
    homers * 10 +
    runs * 2 +
    rbi * 2 +
    walks * 2 +
    steals * 5 +
    k * -1;

  const hits = singles + doubles + triples + homers;
  if (hits >= 3) total += 3;

  return Number.isFinite(total) ? total : 0;
}

export function computeBaseballPitcherFantasyPointsFromRaw(
  raw: BaseballPitcherRawStats
): number {
  const ip = raw.inningsPitched ?? 0;
  const strikeouts = raw.strikeouts ?? 0;
  const wins = raw.wins ?? 0;
  const er = raw.earnedRuns ?? 0;
  const hitsAllowed = raw.hitsAllowed ?? 0;
  const walksAllowed = raw.walksAllowed ?? 0;
  const saves = raw.saves ?? 0;
  const qualityStart = raw.qualityStart ?? 0;

  const total =
    ip * 2.25 +
    strikeouts * 2 +
    wins * 4 +
    er * -2 +
    hitsAllowed * -0.6 +
    walksAllowed * -0.6 +
    saves * 5 +
    qualityStart * 4;

  return Number.isFinite(total) ? total : 0;
}

// ---------- Soccer ----------

export const SOCCER_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Positions: Forward / Midfielder / Defender",
    items: [
      "Goal = +10 pts",
      "Assist = +6 pts",
      "Shot on target = +2 pts",
      "Chance created = +1 pt",
      "Cross = +0.5 pts",
      "Tackle won = +1 pt",
      "Interception = +1 pt",
      "Foul committed = -0.5 pts",
      "Yellow card = -2 pts",
      "Red card = -5 pts",
    ],
  },
  {
    title: "Eligible Position: Goalkeeper",
    items: [
      "Save = +2 pts",
      "Goal allowed = -2 pts",
      "Clean sheet = +5 pts",
      "Penalty save = +5 pts",
      "Win = +3 pts",
    ],
  },
];

export function computeSoccerOutfieldFantasyPointsFromRaw(
  raw: SoccerOutfieldRawStats
): number {
  const goals = raw.goals ?? 0;
  const assists = raw.assists ?? 0;
  const shotsOnTarget = raw.shotsOnTarget ?? 0;
  const chances = raw.chancesCreated ?? 0;
  const crosses = raw.crosses ?? 0;
  const tackles = raw.tacklesWon ?? 0;
  const interceptions = raw.interceptions ?? 0;
  const fouls = raw.foulsCommitted ?? 0;
  const yellows = raw.yellowCards ?? 0;
  const reds = raw.redCards ?? 0;

  const total =
    goals * 10 +
    assists * 6 +
    shotsOnTarget * 2 +
    chances * 1 +
    crosses * 0.5 +
    tackles * 1 +
    interceptions * 1 +
    fouls * -0.5 +
    yellows * -2 +
    reds * -5;

  return Number.isFinite(total) ? total : 0;
}

export function computeSoccerGoalkeeperFantasyPointsFromRaw(
  raw: SoccerGoalkeeperRawStats
): number {
  const saves = raw.saves ?? 0;
  const goalsAllowed = raw.goalsAllowed ?? 0;
  const cleanSheet = raw.cleanSheet ?? 0;
  const penSaves = raw.penaltySaves ?? 0;
  const wins = raw.wins ?? 0;

  const total =
    saves * 2 +
    goalsAllowed * -2 +
    cleanSheet * 5 +
    penSaves * 5 +
    wins * 3;

  return Number.isFinite(total) ? total : 0;
}

// ---------- Golf ----------

export const GOLF_SCORING_RULES: ScoringRuleSection[] = [
  {
    title: "Eligible Position: Golfer",
    items: [
      "Birdie = +3 pts",
      "Eagle = +8 pts",
      "Albatross = +13 pts",
      "Par = +0.5 pts",
      "Bogey = -1 pt",
      "Double bogey or worse = -3 pts",
      "Hole in one = +10 pts",
      "3 birdies or better in a row = +3 pts",
      "Bogey-free round = +5 pts",
      "Round under 70 = +3 pts",
      "Made cut = +5 pts",
      "Top 10 finish = +8 pts",
      "Tournament win = +15 pts",
    ],
  },
];

export function computeGolfFantasyPointsFromRaw(raw: GolfRawStats): number {
  const birdies = raw.birdies ?? 0;
  const eagles = raw.eagles ?? 0;
  const albatrosses = raw.albatrosses ?? 0;
  const pars = raw.pars ?? 0;
  const bogeys = raw.bogeys ?? 0;
  const doubleBogeyOrWorse = raw.doubleBogeyOrWorse ?? 0;
  const holeInOnes = raw.holeInOnes ?? 0;
  const birdieStreaks3Plus = raw.birdieStreaks3Plus ?? 0;
  const bogeyFreeRounds = raw.bogeyFreeRounds ?? 0;
  const roundsUnder70 = raw.roundsUnder70 ?? 0;
  const madeCut = raw.madeCut ?? 0;
  const top10Finish = raw.top10Finish ?? 0;
  const wins = raw.wins ?? 0;

  const total =
    birdies * 3 +
    eagles * 8 +
    albatrosses * 13 +
    pars * 0.5 +
    bogeys * -1 +
    doubleBogeyOrWorse * -3 +
    holeInOnes * 10 +
    birdieStreaks3Plus * 3 +
    bogeyFreeRounds * 5 +
    roundsUnder70 * 3 +
    madeCut * 5 +
    top10Finish * 8 +
    wins * 15;

  return Number.isFinite(total) ? total : 0;
}

// ---------- Admin field definitions by sport/role ----------

export const FOOTBALL_ADMIN_FIELDS: {
  QB: AdminFieldDef[];
  SKILL: AdminFieldDef[];
  K: AdminFieldDef[];
  DST: AdminFieldDef[];
} = {
  QB: [
    { rawKey: "passingYards", laneKey: "footballPassingYards", label: "Pass Yds", inputType: "int", step: 1, quick: [5, 10] },
    { rawKey: "passingTouchdowns", laneKey: "footballPassingTDs", label: "Pass TD", inputType: "int", step: 1, quick: [1] },
    { rawKey: "interceptionsThrown", laneKey: "footballInterceptions", label: "INT", inputType: "int", step: 1, quick: [1] },
    { rawKey: "rushingYards", laneKey: "footballRushingYards", label: "Rush Yds", inputType: "int", step: 5, quick: [5, 10] },
    { rawKey: "rushingTouchdowns", laneKey: "footballRushingTDs", label: "Rush TD", inputType: "int", step: 1, quick: [1] },
    { rawKey: "twoPointConversions", laneKey: "footballTwoPointConversions", label: "2PT", inputType: "int", step: 1 },
    { rawKey: "fumblesLost", laneKey: "footballFumblesLost", label: "Fum Lost", inputType: "int", step: 1 },
  ],
  SKILL: [
    { rawKey: "rushingYards", laneKey: "footballRushingYards", label: "Rush Yds", inputType: "int", step: 1, quick: [5, 10] },
    { rawKey: "rushingTouchdowns", laneKey: "footballRushingTDs", label: "Rush TD", inputType: "int", step: 1, quick: [1] },
    { rawKey: "receptions", laneKey: "footballReceptions", label: "Rec", inputType: "int", step: 1, quick: [1] },
    { rawKey: "receivingYards", laneKey: "footballReceivingYards", label: "Rec Yds", inputType: "int", step: 1, quick: [5, 10] },
    { rawKey: "receivingTouchdowns", laneKey: "footballReceivingTDs", label: "Rec TD", inputType: "int", step: 1, quick: [1] },
    { rawKey: "twoPointConversions", laneKey: "footballTwoPointConversions", label: "2PT", inputType: "int", step: 1 },
    { rawKey: "fumblesLost", laneKey: "footballFumblesLost", label: "Fum Lost", inputType: "int", step: 1 },
  ],
  K: [
    { rawKey: "extraPointsMade", laneKey: "footballExtraPointsMade", label: "XP", inputType: "int", step: 1, quick: [1] },
    { rawKey: "fieldGoals0to39", laneKey: "footballFieldGoals0to39", label: "FG 0–39", inputType: "int", step: 1, quick: [1] },
    { rawKey: "fieldGoals40to49", laneKey: "footballFieldGoals40to49", label: "FG 40–49", inputType: "int", step: 1, quick: [1] },
    { rawKey: "fieldGoals50Plus", laneKey: "footballFieldGoals50Plus", label: "FG 50+", inputType: "int", step: 1, quick: [1] },
    { rawKey: "fieldGoalsMissed", laneKey: "footballFieldGoalsMissed", label: "FG Miss", inputType: "int", step: 1 },
  ],
  DST: [
    { rawKey: "sacks", laneKey: "footballSacks", label: "Sacks", inputType: "int", step: 1, quick: [1] },
    { rawKey: "interceptions", laneKey: "footballDSTInterceptions", label: "INT", inputType: "int", step: 1, quick: [1] },
    { rawKey: "fumbleRecoveries", laneKey: "footballFumbleRecoveries", label: "FR", inputType: "int", step: 1, quick: [1] },
    { rawKey: "defensiveTouchdowns", laneKey: "footballDefensiveTDs", label: "Def TD", inputType: "int", step: 1, quick: [1] },
    { rawKey: "safeties", laneKey: "footballSafeties", label: "Safeties", inputType: "int", step: 1 },
    { rawKey: "blockedKicks", laneKey: "footballBlockedKicks", label: "Blk K", inputType: "int", step: 1 },
    { rawKey: "pointsAllowed", laneKey: "footballPointsAllowed", label: "Pts Allowed", inputType: "int", step: 1 },
  ],
};

export const BASEBALL_ADMIN_FIELDS: {
  HITTER: AdminFieldDef[];
  PITCHER: AdminFieldDef[];
} = {
  HITTER: [
    { rawKey: "singles", laneKey: "baseballSingles", label: "1B", inputType: "int", step: 1, quick: [1] },
    { rawKey: "doubles", laneKey: "baseballDoubles", label: "2B", inputType: "int", step: 1, quick: [1] },
    { rawKey: "triples", laneKey: "baseballTriples", label: "3B", inputType: "int", step: 1, quick: [1] },
    { rawKey: "homeRuns", laneKey: "baseballHomeRuns", label: "HR", inputType: "int", step: 1, quick: [1] },
    { rawKey: "runs", laneKey: "baseballRuns", label: "R", inputType: "int", step: 1, quick: [1] },
    { rawKey: "runsBattedIn", laneKey: "baseballRunsBattedIn", label: "RBI", inputType: "int", step: 1, quick: [1] },
    { rawKey: "walks", laneKey: "baseballWalks", label: "BB", inputType: "int", step: 1, quick: [1] },
    { rawKey: "stolenBases", laneKey: "baseballStolenBases", label: "SB", inputType: "int", step: 1, quick: [1] },
    { rawKey: "strikeouts", laneKey: "baseballStrikeouts", label: "K", inputType: "int", step: 1, quick: [1] },
  ],
  PITCHER: [
    { rawKey: "inningsPitched", laneKey: "baseballInningsPitched", label: "IP", inputType: "float", step: 0.1 },
    { rawKey: "strikeouts", laneKey: "baseballStrikeoutsPitching", label: "K", inputType: "int", step: 1, quick: [1] },
    { rawKey: "wins", laneKey: "baseballWins", label: "W", inputType: "int", step: 1, quick: [1] },
    { rawKey: "earnedRuns", laneKey: "baseballEarnedRuns", label: "ER", inputType: "int", step: 1, quick: [1] },
    { rawKey: "hitsAllowed", laneKey: "baseballHitsAllowed", label: "H", inputType: "int", step: 1, quick: [1] },
    { rawKey: "walksAllowed", laneKey: "baseballWalksAllowed", label: "BB", inputType: "int", step: 1, quick: [1] },
    { rawKey: "saves", laneKey: "baseballSaves", label: "SV", inputType: "int", step: 1, quick: [1] },
    { rawKey: "qualityStart", laneKey: "baseballQualityStart", label: "QS", inputType: "int", step: 1, quick: [1] },
  ],
};

export const SOCCER_ADMIN_FIELDS: {
  OUTFIELD: AdminFieldDef[];
  GOALKEEPER: AdminFieldDef[];
} = {
  OUTFIELD: [
    { rawKey: "goals", laneKey: "soccerGoals", label: "G", inputType: "int", step: 1, quick: [1] },
    { rawKey: "assists", laneKey: "soccerAssists", label: "A", inputType: "int", step: 1, quick: [1] },
    { rawKey: "shotsOnTarget", laneKey: "soccerShotsOnTarget", label: "SoT", inputType: "int", step: 1, quick: [1] },
    { rawKey: "chancesCreated", laneKey: "soccerChancesCreated", label: "Chances", inputType: "int", step: 1 },
    { rawKey: "crosses", laneKey: "soccerCrosses", label: "Crosses", inputType: "int", step: 1 },
    { rawKey: "tacklesWon", laneKey: "soccerTacklesWon", label: "Tackles", inputType: "int", step: 1 },
    { rawKey: "interceptions", laneKey: "soccerInterceptions", label: "INT", inputType: "int", step: 1 },
    { rawKey: "foulsCommitted", laneKey: "soccerFoulsCommitted", label: "Fouls", inputType: "int", step: 1 },
    { rawKey: "yellowCards", laneKey: "soccerYellowCards", label: "YC", inputType: "int", step: 1 },
    { rawKey: "redCards", laneKey: "soccerRedCards", label: "RC", inputType: "int", step: 1 },
  ],
  GOALKEEPER: [
    { rawKey: "saves", laneKey: "soccerSaves", label: "Saves", inputType: "int", step: 1, quick: [1] },
    { rawKey: "goalsAllowed", laneKey: "soccerGoalsAllowed", label: "GA", inputType: "int", step: 1, quick: [1] },
    { rawKey: "cleanSheet", laneKey: "soccerCleanSheet", label: "CS", inputType: "int", step: 1 },
    { rawKey: "penaltySaves", laneKey: "soccerPenaltySaves", label: "PK Save", inputType: "int", step: 1, quick: [1] },
    { rawKey: "wins", laneKey: "soccerWins", label: "Win", inputType: "int", step: 1, quick: [1] },
  ],
};

export const GOLF_ADMIN_FIELDS: {
  GOLFER: AdminFieldDef[];
} = {
  GOLFER: [
    { rawKey: "birdies", laneKey: "golfBirdies", label: "Birdies", inputType: "int", step: 1, quick: [1] },
    { rawKey: "eagles", laneKey: "golfEagles", label: "Eagles", inputType: "int", step: 1, quick: [1] },
    { rawKey: "albatrosses", laneKey: "golfAlbatrosses", label: "Albatrosses", inputType: "int", step: 1, quick: [1] },
    { rawKey: "pars", laneKey: "golfPars", label: "Pars", inputType: "int", step: 1, quick: [1] },
    { rawKey: "bogeys", laneKey: "golfBogeys", label: "Bogeys", inputType: "int", step: 1, quick: [1] },
    { rawKey: "doubleBogeyOrWorse", laneKey: "golfDoubleBogeyOrWorse", label: "DB or Worse", inputType: "int", step: 1, quick: [1] },
    { rawKey: "holeInOnes", laneKey: "golfHoleInOnes", label: "Hole-in-ones", inputType: "int", step: 1, quick: [1] },
    { rawKey: "birdieStreaks3Plus", laneKey: "golfBirdieStreaks3Plus", label: "3+ Birdie Streaks", inputType: "int", step: 1, quick: [1] },
    { rawKey: "bogeyFreeRounds", laneKey: "golfBogeyFreeRounds", label: "Bogey-free Rounds", inputType: "int", step: 1, quick: [1] },
    { rawKey: "roundsUnder70", laneKey: "golfRoundsUnder70", label: "Rounds < 70", inputType: "int", step: 1, quick: [1] },
    { rawKey: "madeCut", laneKey: "golfMadeCut", label: "Made Cut", inputType: "int", step: 1, quick: [1] },
    { rawKey: "top10Finish", laneKey: "golfTop10Finish", label: "Top 10", inputType: "int", step: 1, quick: [1] },
    { rawKey: "wins", laneKey: "golfWins", label: "Wins", inputType: "int", step: 1, quick: [1] },
  ],
};

// ---------- Aggregate sport configuration ----------

export const SPORT_SCORING_RULES_BY_SPORT: Partial<Record<SportKey, ScoringRuleSection[]>> = {
  HOCKEY: HOCKEY_SCORING_RULES,
  BASKETBALL: BASKETBALL_SCORING_RULES,
  FOOTBALL: FOOTBALL_SCORING_RULES,
  BASEBALL: BASEBALL_SCORING_RULES,
  SOCCER: SOCCER_SCORING_RULES,
  GOLF: GOLF_SCORING_RULES,
};

// NOTE: Future work:
// - Add per-position stat field descriptors (admin UI should render from that).
// - Add mapping utilities from external providers (API feeds) to these raw keys.
//   For example, an NHL provider's "shots" field should map into HockeyRawStats.shotsOnGoal.

