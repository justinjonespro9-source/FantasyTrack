import { describe, expect, it } from "vitest";
import {
  contestHasLiveFantasyData,
  getContestPageEmphasis,
} from "@/lib/contest/page-emphasis";

describe("getContestPageEmphasis", () => {
  it("returns PRE_RACE when open and no live data", () => {
    expect(
      getContestPageEmphasis({
        status: "PUBLISHED",
        hasLiveFantasyData: false,
      })
    ).toBe("PRE_RACE");
  });

  it("returns LIVE when fantasy points exist even if still published", () => {
    expect(
      getContestPageEmphasis({
        status: "PUBLISHED",
        hasLiveFantasyData: true,
      })
    ).toBe("LIVE");
  });

  it("returns LIVE for in-progress box score", () => {
    expect(
      getContestPageEmphasis({
        status: "LOCKED",
        hasLiveFantasyData: false,
        liveGameStatus: "InProgress",
      })
    ).toBe("LIVE");
  });

  it("returns FINAL when settled", () => {
    expect(
      getContestPageEmphasis({
        status: "SETTLED",
        hasLiveFantasyData: true,
      })
    ).toBe("FINAL");
  });
});

describe("contestHasLiveFantasyData", () => {
  it("requires a positive fantasy point total", () => {
    expect(
      contestHasLiveFantasyData([{ liveFantasyPoints: 0 }, { fantasyPoints: null }])
    ).toBe(false);
    expect(contestHasLiveFantasyData([{ liveFantasyPoints: 12.4 }])).toBe(true);
  });
});
