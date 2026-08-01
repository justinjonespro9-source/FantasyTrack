import { IMPORT_STATUSES, type ImportStatus } from "./types";

export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[’‘‛‹›]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeTeamAbbr(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePosition(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeDepthRole(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function normalizeStatus(value: string | null | undefined): {
  normalized: ImportStatus | null;
  original: string | null;
  known: boolean;
} {
  if (value == null || !value.trim()) {
    return { normalized: null, original: null, known: true };
  }

  const original = value.trim();
  const upper = original.toUpperCase().replace(/\s+/g, "_");

  const aliases: Record<string, ImportStatus> = {
    ACTIVE: "ACTIVE",
    HEALTHY: "ACTIVE",
    Q: "QUESTIONABLE",
    QUESTIONABLE: "QUESTIONABLE",
    D: "DOUBTFUL",
    DOUBTFUL: "DOUBTFUL",
    O: "OUT",
    OUT: "OUT",
    IR: "IR",
    "INJURED_RESERVE": "IR",
    PUP: "PUP",
    SUSPENDED: "SUSPENDED",
    INACTIVE: "INACTIVE",
    SCRATCHED: "INACTIVE",
    UNKNOWN: "UNKNOWN",
  };

  const normalized = aliases[upper];
  if (normalized && (IMPORT_STATUSES as readonly string[]).includes(normalized)) {
    return { normalized, original, known: true };
  }

  return { normalized: "UNKNOWN", original, known: false };
}

/** Map import status onto existing LaneStatus enum values. */
export function toLaneStatus(
  status: ImportStatus | null
): "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "SCRATCHED" {
  switch (status) {
    case "QUESTIONABLE":
      return "QUESTIONABLE";
    case "DOUBTFUL":
      return "DOUBTFUL";
    case "OUT":
    case "IR":
    case "PUP":
    case "SUSPENDED":
    case "INACTIVE":
      return "SCRATCHED";
    case "ACTIVE":
    case "UNKNOWN":
    case null:
    default:
      return "ACTIVE";
  }
}

export function mapImportSportToContestSport(sport: string | undefined): string | null {
  if (!sport) return null;
  const upper = sport.trim().toUpperCase();
  if (upper === "NFL" || upper === "FOOTBALL") return "FOOTBALL";
  if (upper === "NBA" || upper === "BASKETBALL") return "BASKETBALL";
  if (upper === "NHL" || upper === "HOCKEY") return "HOCKEY";
  if (upper === "MLB" || upper === "BASEBALL") return "BASEBALL";
  return upper;
}
