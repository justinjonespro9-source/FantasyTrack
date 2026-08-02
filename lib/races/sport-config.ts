export type RaceSportKey = "football" | "basketball" | "hockey" | "other";

export const RACE_SPORT_LABELS: Record<RaceSportKey, string> = {
  football: "Football",
  basketball: "Basketball",
  hockey: "Hockey",
  other: "Other",
};

/** Default lead sport for the Races hub; override with FEATURED_RACE_SPORT. */
export function getFeaturedRaceSport(): RaceSportKey {
  const raw = (process.env.FEATURED_RACE_SPORT || "football").trim().toLowerCase();
  if (raw === "basketball" || raw === "hockey" || raw === "football" || raw === "other") {
    return raw;
  }
  if (raw === "nba") return "basketball";
  if (raw === "nhl") return "hockey";
  if (raw === "nfl") return "football";
  return "football";
}

/** Seasonal discovery order — featured sport is always first. */
export function getRaceSportPriority(): RaceSportKey[] {
  const featured = getFeaturedRaceSport();
  const all: RaceSportKey[] = ["football", "basketball", "hockey", "other"];
  return [featured, ...all.filter((s) => s !== featured)];
}

export function normalizeContestSport(sport: string | null | undefined): RaceSportKey {
  const s = (sport ?? "").trim().toUpperCase();
  if (s === "FOOTBALL" || s === "NFL") return "football";
  if (s === "BASKETBALL" || s === "NBA" || s === "CBB" || s === "NCAAB") return "basketball";
  if (s === "HOCKEY" || s === "NHL") return "hockey";
  return "other";
}

export function parseSportFilter(
  value: string | null | undefined
): RaceSportKey | "all" {
  if (!value) return "all";
  const v = value.trim().toLowerCase();
  if (v === "all") return "all";
  if (v === "football" || v === "nfl") return "football";
  if (v === "basketball" || v === "nba") return "basketball";
  if (v === "hockey" || v === "nhl") return "hockey";
  if (v === "other") return "other";
  return "all";
}
