import type { SportKey } from "@/lib/sports";

export type ScoringRuleSection = {
  title: string;
  items: string[];
};

export const SCORING_RULES: Record<SportKey, ScoringRuleSection[]> = {
  FOOTBALL: [
    {
      title: "Eligible Positions: QB / RB / WR / TE",
      items: [
        "Passing TD = +4 pts",
        "25 passing yds = +1 pt (+0.04 pts/yd)",
        "300+ passing yds in a game = +5 pts",
        "Interception = -1 pt",
        "Interception returned for a TD = -4 pts",
        "Rushing TD = +6 pts",
        "10 rushing yds = +1 pt (+0.1 pts/yd)",
        "100+ rushing yds in a game = +5 pts",
        "Receiving TD = +6 pts",
        "10 receiving yds = +1 pt (+0.1 pts/yd)",
        "100+ receiving yds in a game = +5 pts",
        "Reception = +1 pt",
        "Punt / kickoff / field goal return for a TD = +6 pts",
        "Fumble lost = -1 pt",
        "2-point conversion (pass, run, or catch) = +2 pts",
        "Fumble recovery for a TD = +6 pts",
      ],
    },
    {
      title: "Eligible Position: Kicker",
      items: [
        "Extra point = +1 pt",
        "Field goal, 0–39 yds = +3 pts",
        "Field goal, 40–49 yds = +4 pts",
        "Field goal, 50–59 yds = +5 pts",
        "Field goal, 60+ yds = +6 pts",
      ],
    },
    {
      title: "Eligible Position: Defense",
      items: [
        "Sack = +1 pt",
        "Interception = +2 pts",
        "Fumble recovery = +2 pts",
        "Punt / kickoff / field goal return for a TD = +6 pts",
        "Interception returned for a TD = +6 pts",
        "Fumble recovery for a TD = +6 pts",
        "Blocked punt / field goal returned for a TD = +6 pts",
        "Safety = +2 pts",
        "2-point conversion / extra point return = +2 pts",
        "0 points allowed = +10 pts",
        "1–6 points allowed = +7 pts",
        "7–13 points allowed = +4 pts",
        "14–20 points allowed = +1 pt",
        "21–27 points allowed = 0 pts",
        "28–34 points allowed = -1 pt",
        "35+ points allowed = -4 pts",
      ],
    },
  ],
  BASKETBALL: [
    {
      title: "Eligible Positions: All Players",
      items: [
        "Point = +1 pt",
        "3-point field goal made = +0.5 pts",
        "Rebound = +1.25 pts",
        "Assist = +1.5 pts",
        "Steal = +2 pts",
        "Turnover = -0.5 pts",
        "Block = +2 pts",
        "Double-double (points, rebounds, assists, blocks, steals) = +1.5 pts",
        "Triple-double (points, rebounds, assists, blocks, steals) = +5 pts",
      ],
    },
  ],
  BASEBALL: [
    {
      title: "Eligible Position: Batter",
      items: [
        "Single = +3 pts",
        "Double = +5 pts",
        "Triple = +8 pts",
        "Home run = +10 pts",
        "RBI = +2 pts",
        "Run scored = +2 pts",
        "Walk = +2 pts",
        "Hit by pitch = +2 pts",
        "Stolen base = +5 pts",
      ],
    },
    {
      title: "Eligible Position: Pitcher",
      items: [
        "Inning pitched = +2.25 pts (+0.75 pts/out)",
        "Strikeout = +2 pts",
        "Win = +4 pts",
        "Earned run allowed = -2 pts",
        "Hit allowed = -0.6 pts",
        "Walk allowed = -0.6 pts",
        "Hit batter = -0.6 pts",
        "Complete game = +2.5 pts",
        "Complete game shutout = +5 pts",
        "No-hitter = +10 pts",
      ],
    },
  ],
  HOCKEY: [
    {
      title: "Eligible Positions: Forward / Defense / Goalie",
      items: [
        "Goal = +8 pts",
        "Assist = +4 pts",
        "Short-handed goal / assist = +2 pts",
        "Shot on goal = +1 pt",
        "Shootout goal = +2 pts",
        "Hat trick = +5 pts",
        "5+ shots on goal = +3 pts",
        "Blocked shot = +1 pt",
        "3+ blocked shots = +3 pts",
      ],
    },
    {
      title: "Eligible Position: Goalie",
      items: [
        "Save = +0.7 pts",
        "Goal against = -3.5 pts",
        "Shutout = +5 pts",
        "Overtime loss = +2 pts",
        "35+ saves = +3 pts",
      ],
    },
  ],
  SOCCER: [
    {
      title: "Eligible Position: Player",
      items: [
        "Goal = +10 pts",
        "Assist = +5 pts",
        "Shot on goal = +1 pt",
        "Chance created (pass leading to a shot on goal) = +1 pt",
        "Appearance (starter or substitute) = +1 pt",
        "Tackle won = +0.5 pts",
        "Interception = +0.5 pts",
        "Accurate pass = +0.2 pts",
        "Block = +0.5 pts",
        "Foul conceded = -0.5 pts",
        "Foul drawn = +1 pt",
        "Yellow card = -2 pts",
        "Red card = -5 pts",
        "Clean sheet = +3 pts",
        "Shootout goal = +1.5 pts",
        "Shootout miss = -1 pt",
      ],
    },
    {
      title: "Eligible Position: Goalie",
      items: [
        "Save = +2 pts",
        "Goal against = -2 pts",
        "Clean sheet = +5 pts",
        "Win = +5 pts",
        "Penalty kick save = +2 pts",
        "Shootout save = +1 pt",
      ],
    },
  ],
};

export function getScoringRules(sport: string | null | undefined): ScoringRuleSection[] {
  if (!sport) {
    return [
      {
        title: "Scoring Rules",
        items: ["Scoring rules unavailable."],
      },
    ];
  }

  const normalized = sport.toUpperCase() as SportKey;

  return (
    SCORING_RULES[normalized] ?? [
      {
        title: "Scoring Rules",
        items: ["Scoring rules unavailable."],
      },
    ]
  );
}