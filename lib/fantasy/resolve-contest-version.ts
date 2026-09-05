/**
 * Map FantasyTrack contest.scoringFormat → versioned engine slug.
 * Settled lane.fantasyPoints are never recomputed; this only affects live scoring.
 *
 * Canonical new weeks: FANTASYTRACK_NFL_HALF_PPR_V2
 * Historical: PPR → Full PPR V1; explicit HALF_PPR_V1 slug stays V1 (no bonuses)
 */
import {
  DEFAULT_FANTASY_SCORING_VERSION,
  FANTASYTRACK_NFL_FULL_PPR_V1,
  FANTASYTRACK_NFL_HALF_PPR_V1,
  FANTASYTRACK_NFL_HALF_PPR_V2,
  type FantasyScoringVersion,
} from "@/lib/fantasy/scoring-config";

export function resolveContestFantasyScoringVersion(
  scoringFormat: string | null | undefined
): FantasyScoringVersion {
  const raw = (scoringFormat ?? "").trim().toUpperCase();

  if (
    raw === "PPR" ||
    raw === "FULL_PPR" ||
    raw === FANTASYTRACK_NFL_FULL_PPR_V1
  ) {
    return FANTASYTRACK_NFL_FULL_PPR_V1;
  }

  // Explicit historical Half PPR without milestones
  if (raw === FANTASYTRACK_NFL_HALF_PPR_V1 || raw === "HALF_PPR_V1") {
    return FANTASYTRACK_NFL_HALF_PPR_V1;
  }

  // Canonical Half PPR + yardage bonuses (V2)
  if (
    raw === "HALF_PPR" ||
    raw === "HALF-PPR" ||
    raw === FANTASYTRACK_NFL_HALF_PPR_V2 ||
    raw === "HALF_PPR_V2" ||
    raw === ""
  ) {
    return FANTASYTRACK_NFL_HALF_PPR_V2;
  }

  // Unknown formats fall back to current canonical V2.
  // Historical settled totals remain as stored on Lane.fantasyPoints.
  return DEFAULT_FANTASY_SCORING_VERSION;
}
