import {
  IMPORT_CLOSE_TAG,
  IMPORT_OPEN_TAG,
  KNOWN_CONTEST_TYPES,
  KNOWN_SCORING,
  KNOWN_SLATES,
  KNOWN_SPORTS,
  type FantasyTrackImportIssue,
  type FantasyTrackImportMetadata,
  type FantasyTrackImportResult,
  type FantasyTrackImportRow,
} from "./types";
import { normalizeDepthRole, normalizeStatus, normalizeTeamAbbr } from "./normalize";

function isPipeRow(line: string): boolean {
  return line.includes("|");
}

function parseMetadataLine(
  line: string,
  warnings: FantasyTrackImportIssue[]
): { key: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const key = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (!key) return null;

  const knownKeys = [
    "contestType",
    "sport",
    "season",
    "week",
    "position",
    "scoring",
    "slate",
  ];
  if (!knownKeys.includes(key)) {
    warnings.push({
      severity: "warning",
      field: key,
      message: `Unknown metadata key "${key}"`,
      code: "UNKNOWN_METADATA_KEY",
    });
  }

  return { key, value };
}

function applyMetadataValue(
  metadata: FantasyTrackImportMetadata,
  key: string,
  value: string,
  warnings: FantasyTrackImportIssue[]
) {
  if (key === "season" || key === "week") {
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      warnings.push({
        severity: "warning",
        field: key,
        message: `Metadata "${key}" should be an integer; got "${value}"`,
        code: "INVALID_METADATA_NUMBER",
      });
      return;
    }
    metadata[key] = num;
    return;
  }

  const upper = value.toUpperCase();
  if (key === "contestType" && !(KNOWN_CONTEST_TYPES as readonly string[]).includes(upper)) {
    warnings.push({
      severity: "warning",
      field: key,
      message: `Unknown contestType "${value}"`,
      code: "UNKNOWN_METADATA_VALUE",
    });
  }
  if (key === "sport" && !(KNOWN_SPORTS as readonly string[]).includes(upper) && upper !== "FOOTBALL") {
    warnings.push({
      severity: "warning",
      field: key,
      message: `Unknown sport "${value}"`,
      code: "UNKNOWN_METADATA_VALUE",
    });
  }
  if (key === "scoring" && !(KNOWN_SCORING as readonly string[]).includes(upper)) {
    warnings.push({
      severity: "warning",
      field: key,
      message: `Unknown scoring "${value}"`,
      code: "UNKNOWN_METADATA_VALUE",
    });
  }
  if (key === "slate" && !(KNOWN_SLATES as readonly string[]).includes(upper)) {
    warnings.push({
      severity: "warning",
      field: key,
      message: `Unknown slate "${value}"`,
      code: "UNKNOWN_METADATA_VALUE",
    });
  }

  metadata[key] = key === "position" ? upper : upper;
  if (key === "position") metadata.position = value.trim().toUpperCase();
  else if (key === "scoring") metadata.scoring = upper;
  else if (key === "slate") metadata.slate = upper;
  else if (key === "contestType") metadata.contestType = upper;
  else if (key === "sport") metadata.sport = upper;
  else metadata[key] = value;
}

function parsePlayerRow(
  line: string,
  sourceRowNumber: number
): { row?: FantasyTrackImportRow; error?: FantasyTrackImportIssue } {
  const parts = line.split("|").map((p) => p.trim());

  if (parts.length < 5) {
    return {
      error: {
        severity: "error",
        row: sourceRowNumber,
        message: `Player row could not be parsed (expected at least 5 fields, got ${parts.length})`,
        code: "UNPARSEABLE_ROW",
      },
    };
  }

  const rankRaw = parts[0];
  const playerName = parts[1] ?? "";
  const team = normalizeTeamAbbr(parts[2] ?? "");
  const opponent = normalizeTeamAbbr(parts[3] ?? "");
  const position = (parts[4] ?? "").trim().toUpperCase();
  const depthRole = normalizeDepthRole(parts[5] ?? null);

  let projectedPoints: number | null = null;
  let projectedPointsInvalid = false;
  if (parts.length >= 7 && parts[6] !== "") {
    const n = Number(parts[6]);
    if (!Number.isFinite(n)) {
      projectedPointsInvalid = true;
    } else {
      projectedPoints = n;
    }
  }

  const statusRaw = parts.length >= 8 ? parts[7] || null : null;
  const statusInfo = normalizeStatus(statusRaw);

  // Extra pipes fold into notes (field 9+)
  let notes: string | null = null;
  if (parts.length >= 9) {
    notes = parts.slice(8).join(" | ").trim() || null;
  }

  const rankNum = Number(rankRaw);
  const rank =
    rankRaw !== "" && Number.isFinite(rankNum) && Number.isInteger(rankNum) ? rankNum : null;

  const row: FantasyTrackImportRow = {
    sourceRowNumber,
    rank,
    playerName,
    team,
    opponent,
    position,
    depthRole,
    projectedPoints: projectedPointsInvalid ? null : projectedPoints,
    status: statusInfo.original,
    statusNormalized: statusInfo.normalized,
    notes,
    included: true,
  };

  if (rankRaw !== "" && rank === null) {
    return {
      row,
      error: {
        severity: "error",
        row: sourceRowNumber,
        field: "rank",
        message: `Non-numeric rank "${rankRaw}"`,
        code: "INVALID_RANK",
      },
    };
  }

  if (projectedPointsInvalid) {
    return {
      row,
      error: {
        severity: "error",
        row: sourceRowNumber,
        field: "projectedPoints",
        message: `Invalid projected-points value "${parts[6]}"`,
        code: "INVALID_PROJECTED_POINTS",
      },
    };
  }

  if (!statusInfo.known && statusInfo.original) {
    return {
      row,
      error: undefined,
    };
  }

  return { row };
}

export function parseFantasyTrackImport(rawText: string): FantasyTrackImportResult {
  const errors: FantasyTrackImportIssue[] = [];
  const warnings: FantasyTrackImportIssue[] = [];
  const metadata: FantasyTrackImportMetadata = {};
  const rows: FantasyTrackImportRow[] = [];

  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) {
    errors.push({
      severity: "error",
      message: "Import text is empty",
      code: "EMPTY_IMPORT",
    });
    return { metadata, rows, errors, warnings };
  }

  const openIdx = text.indexOf(IMPORT_OPEN_TAG);
  const closeIdx = text.indexOf(IMPORT_CLOSE_TAG);

  if (openIdx < 0) {
    errors.push({
      severity: "error",
      message: `Missing opening tag ${IMPORT_OPEN_TAG}`,
      code: "MISSING_OPEN_TAG",
    });
  }
  if (closeIdx < 0) {
    errors.push({
      severity: "error",
      message: `Missing closing tag ${IMPORT_CLOSE_TAG}`,
      code: "MISSING_CLOSE_TAG",
    });
  }

  if (openIdx < 0 || closeIdx < 0) {
    return { metadata, rows, errors, warnings };
  }

  if (closeIdx < openIdx) {
    errors.push({
      severity: "error",
      message: "Closing import tag appears before opening tag",
      code: "TAG_ORDER",
    });
    return { metadata, rows, errors, warnings };
  }

  const body = text.slice(openIdx + IMPORT_OPEN_TAG.length, closeIdx);
  const lines = body.split("\n");
  let inPlayerSection = false;
  let fileLineNumber = text.slice(0, openIdx).split("\n").length;

  for (const rawLine of lines) {
    fileLineNumber += 1;
    const line = rawLine.trim();
    if (!line) continue;

    if (!inPlayerSection && isPipeRow(line)) {
      inPlayerSection = true;
    }

    if (!inPlayerSection) {
      const meta = parseMetadataLine(line, warnings);
      if (meta) {
        applyMetadataValue(metadata, meta.key, meta.value, warnings);
      } else {
        warnings.push({
          severity: "warning",
          row: fileLineNumber,
          message: `Skipping unrecognized metadata line: "${line}"`,
          code: "UNRECOGNIZED_LINE",
        });
      }
      continue;
    }

    const parsed = parsePlayerRow(line, fileLineNumber);
    if (parsed.row) {
      rows.push(parsed.row);
      if (!normalizeStatus(parsed.row.status).known && parsed.row.status) {
        warnings.push({
          severity: "warning",
          row: fileLineNumber,
          field: "status",
          message: `Unknown status "${parsed.row.status}"`,
          code: "UNKNOWN_STATUS",
        });
      }
    }
    if (parsed.error) {
      errors.push(parsed.error);
    }
  }

  return { metadata, rows, errors, warnings };
}
