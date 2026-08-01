import { describe, expect, it } from "vitest";
import {
  buildWeeklyRaceHeadline,
  formatContestLifecycleLabel,
  formatScoringLabel,
  formatSlateLabel,
} from "./contest-presentation";

describe("contest presentation", () => {
  it("builds NFL weekly position race headline", () => {
    const copy = buildWeeklyRaceHeadline({
      title: "Week 1 Sunday RB",
      sport: "FOOTBALL",
      season: 2026,
      week: 1,
      position: "RB",
    });
    expect(copy.headline).toBe("NFL Week 1 RB Race");
    expect(copy.supporting).toMatch(/running back/i);
  });

  it("maps lifecycle labels for public trust copy", () => {
    expect(formatContestLifecycleLabel("DRAFT")).toBe("Draft");
    expect(formatContestLifecycleLabel("PUBLISHED")).toBe("Open");
    expect(formatContestLifecycleLabel("LOCKED")).toBe("Locked");
    expect(formatContestLifecycleLabel("SETTLED")).toBe("Final");
  });

  it("formats slate and scoring labels", () => {
    expect(formatSlateLabel("SUNDAY_AFTERNOON")).toBe("Sunday afternoon games");
    expect(formatScoringLabel("PPR")).toBe("Full PPR");
  });
});
