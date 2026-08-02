import type { ContestStatus } from "@prisma/client";

export type ContestPageEmphasis = "PRE_RACE" | "LIVE" | "FINAL";

type EmphasisInput = {
  status: ContestStatus | string;
  /** True when any runner has positive live/final fantasy points. */
  hasLiveFantasyData: boolean;
  liveGameStatus?: string | null;
};

/**
 * Determines contest-page content priority.
 * Prefer live fantasy / box-score signals over status alone when they disagree.
 */
export function getContestPageEmphasis(input: EmphasisInput): ContestPageEmphasis {
  const status = String(input.status).toUpperCase();
  if (status === "SETTLED") return "FINAL";

  const game = (input.liveGameStatus ?? "").trim().toLowerCase();
  if (game === "final" || game === "f/ot") {
    return status === "SETTLED" ? "FINAL" : "LIVE";
  }

  if (input.hasLiveFantasyData || game === "inprogress") {
    return "LIVE";
  }

  return "PRE_RACE";
}

export function contestHasLiveFantasyData(
  lanes: Array<{ liveFantasyPoints?: number | null; fantasyPoints?: number | null }>
): boolean {
  return lanes.some((lane) => {
    const pts = lane.liveFantasyPoints ?? lane.fantasyPoints;
    return pts != null && Number.isFinite(pts) && pts > 0;
  });
}
