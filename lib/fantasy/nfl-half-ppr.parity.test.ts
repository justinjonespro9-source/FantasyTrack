import { describe, expect, it } from "vitest";
import {
  FANTASYTRACK_NFL_FULL_PPR_V1,
  FANTASYTRACK_NFL_HALF_PPR_V1,
  FANTASYTRACK_NFL_HALF_PPR_V2,
  assignCompetitionRanks,
  fantasyTrackFantasyScoring,
  getFantasyRules,
  scoreDefenseFantasy,
  scorePlayerFantasy,
  scoreWeeklyPlayerFantasy,
} from "@/lib/fantasy";
import { resolveContestFantasyScoringVersion } from "@/lib/fantasy/resolve-contest-version";
import {
  computeFootballDSTFantasyPointsFromRaw,
  computeFootballQBFantasyPointsFromRaw,
  computeFootballSkillFantasyPointsFromRaw,
} from "@/lib/scoring-config";

describe("canonical Half PPR V2 (RankEyeQ production parity)", () => {
  it("defaults to FANTASYTRACK_NFL_HALF_PPR_V2 with 0.5 PPR and +5 milestones", () => {
    const { version, player } = getFantasyRules();
    expect(version).toBe(FANTASYTRACK_NFL_HALF_PPR_V2);
    expect(player.reception).toBe(0.5);
    expect(player.passingYardsBonus).toBe(5);
    expect(player.rushingYardsBonus).toBe(5);
    expect(player.receivingYardsBonus).toBe(5);
  });

  it("maps HALF_PPR contest format to V2", () => {
    expect(resolveContestFantasyScoringVersion("HALF_PPR")).toBe(
      FANTASYTRACK_NFL_HALF_PPR_V2
    );
    expect(resolveContestFantasyScoringVersion(null)).toBe(
      FANTASYTRACK_NFL_HALF_PPR_V2
    );
    expect(resolveContestFantasyScoringVersion("PPR")).toBe(
      FANTASYTRACK_NFL_FULL_PPR_V1
    );
    expect(
      resolveContestFantasyScoringVersion(FANTASYTRACK_NFL_HALF_PPR_V1)
    ).toBe(FANTASYTRACK_NFL_HALF_PPR_V1);
  });

  it("applies one-time 300+ passing bonus (+5), not repeated for extra yards", () => {
    expect(
      computeFootballQBFantasyPointsFromRaw({ passingYards: 299 }, "HALF_PPR")
    ).toBeCloseTo(299 / 25, 5);
    expect(
      computeFootballQBFantasyPointsFromRaw({ passingYards: 300 }, "HALF_PPR")
    ).toBe(12 + 5); // 300/25=12 + 5 bonus
    expect(
      computeFootballQBFantasyPointsFromRaw({ passingYards: 400 }, "HALF_PPR")
    ).toBe(16 + 5);
  });

  it("applies stackable 100+ rush and receiving bonuses", () => {
    const result = scorePlayerFantasy({
      rushingYards: 100,
      receivingYards: 100,
      receptions: 0,
    });
    // 10 + 10 + 5 rush bonus + 5 rec bonus = 30
    expect(result.components.rushingYardsBonus).toBe(5);
    expect(result.components.receivingYardsBonus).toBe(5);
    expect(result.fantasyPoints).toBe(30);
  });

  it("scores skill Half PPR with rush milestone (RankEyeQ fixture)", () => {
    // 100 rush + 1 rush TD + 4 rec (0.5) + 30 rec yds + rush bonus = 10+6+2+3+5 = 26
    expect(
      computeFootballSkillFantasyPointsFromRaw(
        {
          rushingYards: 100,
          rushingTouchdowns: 1,
          receptions: 4,
          receivingYards: 30,
        },
        "HALF_PPR"
      )
    ).toBe(26);
  });

  it("awards +6 player return TD", () => {
    expect(
      computeFootballSkillFantasyPointsFromRaw(
        { returnTouchdowns: 1 },
        "HALF_PPR"
      )
    ).toBe(6);
  });

  it("scores D/ST points-allowed tiers and ST/Def TDs", () => {
    expect(
      computeFootballDSTFantasyPointsFromRaw({ pointsAllowed: 0 }, "HALF_PPR")
    ).toBe(10);
    expect(
      computeFootballDSTFantasyPointsFromRaw({ pointsAllowed: 6 }, "HALF_PPR")
    ).toBe(7);
    expect(
      computeFootballDSTFantasyPointsFromRaw({ pointsAllowed: 35 }, "HALF_PPR")
    ).toBe(-4);
    expect(
      computeFootballDSTFantasyPointsFromRaw(
        {
          specialTeamsTouchdowns: 1,
          defensiveTouchdowns: 1,
          pointsAllowed: 24,
        },
        "HALF_PPR"
      )
    ).toBe(12);
  });
});

describe("historical versions preserved", () => {
  it("Half PPR V1 still has no yardage bonuses", () => {
    const { player } = getFantasyRules(FANTASYTRACK_NFL_HALF_PPR_V1);
    expect(player.passingYardsBonus).toBe(0);
    expect(
      scorePlayerFantasy({ passingYards: 300 }, player).fantasyPoints
    ).toBe(12);
  });

  it("Full PPR still scores 1.0 per reception and no milestones", () => {
    expect(
      computeFootballSkillFantasyPointsFromRaw(
        { receptions: 8, receivingYards: 120, receivingTouchdowns: 1 },
        "PPR"
      )
    ).toBe(26); // 8 + 12 + 6, no receiving bonus under Full V1
  });
});

describe("competition ranking", () => {
  it("assigns 1,2,2,4", () => {
    const ranked = assignCompetitionRanks(
      [
        { id: "a", pts: 30 },
        { id: "b", pts: 25 },
        { id: "c", pts: 25 },
        { id: "d", pts: 20 },
      ],
      (row) => row.pts
    );
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
  });

  it("facade sample matches RankEyeQ V2 RB line", () => {
    // 8.5 rush + 6 TD + 3 rec (6*0.5) + 4.5 rec yds - 2 fumble = 20 (no 100-yard bonus)
    const pts = fantasyTrackFantasyScoring.scorePlayer({
      rushingYards: 85,
      rushingTds: 1,
      receptions: 6,
      receivingYards: 45,
      fumblesLost: 1,
    });
    expect(pts.fantasyPoints).toBe(20);
    expect(scoreWeeklyPlayerFantasy({ receptions: 4 }).fantasyPoints).toBe(2);
  });
});

describe("return TD components", () => {
  it("does not double-count return TD as rush/rec TD", () => {
    const result = scorePlayerFantasy({ returnTds: 1 });
    expect(result.components.returnTds).toBe(6);
    expect(result.components.rushingTds).toBe(0);
    expect(result.components.receivingTds).toBe(0);
  });

  it("credits ST TD and Def TD separately on D/ST", () => {
    const result = scoreDefenseFantasy({
      specialTeamsTds: 1,
      defensiveTds: 1,
      pointsAllowed: 24,
    });
    expect(result.components.touchdowns).toBe(12);
  });
});
