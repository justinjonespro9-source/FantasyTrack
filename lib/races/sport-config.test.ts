import { describe, expect, it } from "vitest";
import {
  getFeaturedRaceSport,
  getRaceSportPriority,
  normalizeContestSport,
  parseSportFilter,
} from "./sport-config";

describe("race sport config", () => {
  it("defaults featured sport to football", () => {
    expect(getFeaturedRaceSport()).toBe("football");
    expect(getRaceSportPriority()[0]).toBe("football");
  });

  it("normalizes contest sports", () => {
    expect(normalizeContestSport("FOOTBALL")).toBe("football");
    expect(normalizeContestSport("NFL")).toBe("football");
    expect(normalizeContestSport("BASKETBALL")).toBe("basketball");
    expect(normalizeContestSport("HOCKEY")).toBe("hockey");
  });

  it("parses sport filter query values", () => {
    expect(parseSportFilter(undefined)).toBe("all");
    expect(parseSportFilter("football")).toBe("football");
    expect(parseSportFilter("nba")).toBe("basketball");
  });
});
