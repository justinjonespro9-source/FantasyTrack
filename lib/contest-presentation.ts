export const SLATE_LABELS: Record<string, string> = {
  SUNDAY_EARLY: "Sunday early games",
  SUNDAY_LATE: "Sunday late games",
  SUNDAY_AFTERNOON: "Sunday afternoon games",
  PRIME_TIME: "Prime-time games",
  SINGLE_GAME: "Single game",
  CUSTOM: "Custom slate",
};

export const SCORING_LABELS: Record<string, string> = {
  PPR: "Full PPR",
  HALF_PPR: "Half PPR",
  STANDARD: "Standard",
};

export function formatSlateLabel(slate?: string | null): string | null {
  if (!slate) return null;
  return SLATE_LABELS[slate.toUpperCase()] ?? slate;
}

export function formatScoringLabel(scoring?: string | null): string | null {
  if (!scoring) return null;
  return SCORING_LABELS[scoring.toUpperCase()] ?? scoring;
}

export function buildWeeklyRaceHeadline(params: {
  title?: string | null;
  sport?: string | null;
  season?: number | null;
  week?: number | null;
  position?: string | null;
}): { headline: string; supporting: string | null } {
  const position = (params.position ?? "").trim().toUpperCase();
  const week = params.week;
  const isFootball = (params.sport ?? "").toUpperCase() === "FOOTBALL";

  if (isFootball && week != null && position) {
    const posLabel =
      position === "RB"
        ? "running back"
        : position === "WR"
          ? "wide receiver"
          : position === "TE"
            ? "tight end"
            : position === "QB"
              ? "quarterback"
              : "player";
    return {
      headline: `NFL Week ${week} ${position} Race`,
      supporting: `Which ${posLabel} will finish Sunday with the most fantasy points?`,
    };
  }

  return {
    headline: params.title?.trim() || "FantasyTrack Contest",
    supporting: null,
  };
}

/** Product-facing status labels mapped onto ContestStatus. */
export function formatContestLifecycleLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Open";
    case "LOCKED":
      return "Locked";
    case "SETTLED":
      return "Final";
    default:
      return status;
  }
}

export function formatContestLifecycleHelp(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft — import the field, review runners, then publish when ready.";
    case "PUBLISHED":
      return "Open for free-play entries until lock. Rankings organize the field; the pool sets the odds.";
    case "LOCKED":
      return "Entries closed. Closing odds are preserved while the race is graded.";
    case "SETTLED":
      return "Final results are posted. Review standings and free-play payouts.";
    default:
      return "";
  }
}
