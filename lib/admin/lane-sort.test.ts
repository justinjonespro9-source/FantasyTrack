import { describe, expect, it } from "vitest";
import {
  compareLanesByProjectedRank,
  defaultAdminLaneSortKey,
  formatAdminLaneRank,
  sortLanesForAdminOdds,
} from "./lane-sort";

describe("admin lane sort", () => {
  const field = [
    { id: "p", name: "Samaje Perine", seedRank: 48, displayOrder: 48, projectedPoints: 3.1 },
    { id: "b", name: "Bijan Robinson", seedRank: 2, displayOrder: 2, projectedPoints: 18.5 },
    { id: "g", name: "Jahmyr Gibbs", seedRank: 1, displayOrder: 1, projectedPoints: 20.2 },
    { id: "u", name: "AAA Unranked", seedRank: null, displayOrder: null, projectedPoints: 99 },
    { id: "t", name: "Jonathan Taylor", seedRank: 3, displayOrder: 3, projectedPoints: 17.0 },
  ];

  it("orders by seedRank with unranked last", () => {
    const sorted = sortLanesForAdminOdds(field, "PROJECTED_RANK");
    expect(sorted.map((l) => l.name)).toEqual([
      "Jahmyr Gibbs",
      "Bijan Robinson",
      "Jonathan Taylor",
      "Samaje Perine",
      "AAA Unranked",
    ]);
  });

  it("defaults to projected rank when seedRank exists", () => {
    expect(defaultAdminLaneSortKey(field)).toBe("PROJECTED_RANK");
    expect(
      defaultAdminLaneSortKey([{ id: "1", name: "Zebra", seedRank: null }])
    ).toBe("ALPHABETICAL");
  });

  it("keeps alphabetical for legacy contests", () => {
    const legacy = [
      { id: "2", name: "Zebra", seedRank: null, displayOrder: null, projectedPoints: null },
      { id: "1", name: "Alpha", seedRank: null, displayOrder: null, projectedPoints: null },
    ];
    expect(sortLanesForAdminOdds(legacy).map((l) => l.name)).toEqual(["Alpha", "Zebra"]);
  });

  it("formats visible rank from seedRank then displayOrder", () => {
    expect(formatAdminLaneRank({ seedRank: 1, displayOrder: 9 })).toBe("1");
    expect(formatAdminLaneRank({ seedRank: null, displayOrder: 4 })).toBe("4");
    expect(formatAdminLaneRank({ seedRank: null, displayOrder: null })).toBe("—");
  });

  it("compare helper places seed-ranked before unranked regardless of name", () => {
    expect(
      compareLanesByProjectedRank(
        { id: "z", name: "ZZZ", seedRank: 10 },
        { id: "a", name: "AAA", seedRank: null }
      )
    ).toBeLessThan(0);
  });
});
