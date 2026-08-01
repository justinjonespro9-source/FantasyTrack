export type AdminLaneSortKey = "PROJECTED_RANK" | "PROJECTED_POINTS" | "ALPHABETICAL";

export type RankableLane = {
  id: string;
  name: string;
  seedRank?: number | null;
  displayOrder?: number | null;
  projectedPoints?: number | null;
};

/** Visible rank in odds-entry: seedRank, else displayOrder, else em dash. */
export function formatAdminLaneRank(
  lane: Pick<RankableLane, "seedRank" | "displayOrder">
): string {
  if (lane.seedRank != null && Number.isFinite(lane.seedRank)) {
    return String(lane.seedRank);
  }
  if (lane.displayOrder != null && Number.isFinite(lane.displayOrder)) {
    return String(lane.displayOrder);
  }
  return "—";
}

export function hasImportedRankings(lanes: RankableLane[]): boolean {
  return lanes.some((l) => l.seedRank != null && Number.isFinite(l.seedRank));
}

function compareNullableAsc(a: number | null | undefined, b: number | null | undefined): number {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing last
  if (bMissing) return -1;
  return (a as number) - (b as number);
}

function compareNullableDesc(a: number | null | undefined, b: number | null | undefined): number {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return (b as number) - (a as number);
}

/**
 * Imported-field order for admin odds entry:
 * seedRank asc → displayOrder asc → projectedPoints desc → name asc.
 * Lanes with a valid seedRank always precede unranked lanes.
 */
export function compareLanesByProjectedRank(a: RankableLane, b: RankableLane): number {
  const aHasSeed = a.seedRank != null && Number.isFinite(a.seedRank);
  const bHasSeed = b.seedRank != null && Number.isFinite(b.seedRank);
  if (aHasSeed !== bHasSeed) return aHasSeed ? -1 : 1;

  if (aHasSeed && bHasSeed) {
    const bySeed = (a.seedRank as number) - (b.seedRank as number);
    if (bySeed !== 0) return bySeed;
  }

  const byDisplay = compareNullableAsc(a.displayOrder, b.displayOrder);
  if (byDisplay !== 0) return byDisplay;

  const byProj = compareNullableDesc(a.projectedPoints, b.projectedPoints);
  if (byProj !== 0) return byProj;

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function compareLanesByProjectedPoints(a: RankableLane, b: RankableLane): number {
  const byProj = compareNullableDesc(a.projectedPoints, b.projectedPoints);
  if (byProj !== 0) return byProj;
  return compareLanesByProjectedRank(a, b);
}

export function compareLanesAlphabetical(a: RankableLane, b: RankableLane): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function defaultAdminLaneSortKey(lanes: RankableLane[]): AdminLaneSortKey {
  return hasImportedRankings(lanes) ? "PROJECTED_RANK" : "ALPHABETICAL";
}

export function sortLanesForAdminOdds<T extends RankableLane>(
  lanes: T[],
  sortKey: AdminLaneSortKey = defaultAdminLaneSortKey(lanes)
): T[] {
  const copy = [...lanes];
  const compare =
    sortKey === "PROJECTED_POINTS"
      ? compareLanesByProjectedPoints
      : sortKey === "ALPHABETICAL"
        ? compareLanesAlphabetical
        : compareLanesByProjectedRank;
  copy.sort(compare);
  return copy;
}
