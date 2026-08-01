import { normalizePlayerName } from "./normalize";
import type {
  ContestImportContext,
  FantasyTrackImportIssue,
  FantasyTrackImportMetadata,
  FantasyTrackImportResult,
  FantasyTrackImportRow,
  ImportValidationSummary,
  ValidatedImportRow,
} from "./types";

function addIssue(
  rowIssues: FantasyTrackImportIssue[],
  globalErrors: FantasyTrackImportIssue[],
  globalWarnings: FantasyTrackImportIssue[],
  issue: FantasyTrackImportIssue
) {
  rowIssues.push(issue);
  if (issue.severity === "error") globalErrors.push(issue);
  else globalWarnings.push(issue);
}

export function validateFantasyTrackImport(
  parsed: FantasyTrackImportResult,
  contest?: ContestImportContext | null,
  options?: { expectedRoles?: string[] }
): {
  rows: ValidatedImportRow[];
  errors: FantasyTrackImportIssue[];
  warnings: FantasyTrackImportIssue[];
  summary: ImportValidationSummary;
} {
  const errors: FantasyTrackImportIssue[] = [...parsed.errors];
  const warnings: FantasyTrackImportIssue[] = [...parsed.warnings];
  const validated: ValidatedImportRow[] = [];

  const rankSeen = new Map<number, number>();
  const nameSeen = new Map<string, number>();
  const teams = new Set<string>();
  const roleCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  for (const row of parsed.rows) {
    const issues: FantasyTrackImportIssue[] = [];
    const included = row.included !== false;

    if (!included) {
      validated.push({ ...row, issues, state: "ready" });
      continue;
    }

    if (!row.playerName.trim()) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "playerName",
        message: "Missing player name",
        code: "MISSING_NAME",
      });
    }
    if (!row.team) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "team",
        message: "Missing team",
        code: "MISSING_TEAM",
      });
    }
    if (!row.opponent) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "opponent",
        message: "Missing opponent",
        code: "MISSING_OPPONENT",
      });
    }
    if (!row.position) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "position",
        message: "Missing position",
        code: "MISSING_POSITION",
      });
    }
    if (row.rank == null) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "rank",
        message: "Missing or non-numeric rank",
        code: "MISSING_RANK",
      });
    } else if (rankSeen.has(row.rank)) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "rank",
        message: `Duplicate rank ${row.rank} (also on row ${rankSeen.get(row.rank)})`,
        code: "DUPLICATE_RANK",
      });
    } else {
      rankSeen.set(row.rank, row.sourceRowNumber);
    }

    const nameKey = normalizePlayerName(row.playerName);
    if (nameKey) {
      if (nameSeen.has(nameKey)) {
        addIssue(issues, errors, warnings, {
          severity: "error",
          row: row.sourceRowNumber,
          field: "playerName",
          message: `Duplicate player "${row.playerName}" in this import`,
          code: "DUPLICATE_PLAYER",
        });
      } else {
        nameSeen.set(nameKey, row.sourceRowNumber);
      }
    }

    if (row.team && row.opponent && row.team === row.opponent) {
      addIssue(issues, errors, warnings, {
        severity: "error",
        row: row.sourceRowNumber,
        field: "opponent",
        message: "Team equals opponent",
        code: "TEAM_EQUALS_OPPONENT",
      });
    }

    if (row.projectedPoints == null) {
      addIssue(issues, errors, warnings, {
        severity: "warning",
        row: row.sourceRowNumber,
        field: "projectedPoints",
        message: "Missing projection",
        code: "MISSING_PROJECTION",
      });
    }
    if (!row.depthRole) {
      addIssue(issues, errors, warnings, {
        severity: "warning",
        row: row.sourceRowNumber,
        field: "depthRole",
        message: "Missing depth role",
        code: "MISSING_DEPTH_ROLE",
      });
    }
    if (!row.status) {
      addIssue(issues, errors, warnings, {
        severity: "warning",
        row: row.sourceRowNumber,
        field: "status",
        message: "Missing status",
        code: "MISSING_STATUS",
      });
    }

    if (
      row.statusNormalized &&
      ["QUESTIONABLE", "DOUBTFUL", "OUT", "IR", "PUP", "SUSPENDED", "INACTIVE"].includes(
        row.statusNormalized
      )
    ) {
      addIssue(issues, errors, warnings, {
        severity: "warning",
        row: row.sourceRowNumber,
        field: "status",
        message: `Player status is ${row.statusNormalized}`,
        code: "NON_ACTIVE_STATUS",
      });
    }

    if (row.team) teams.add(row.team);
    if (row.depthRole) {
      roleCounts[row.depthRole] = (roleCounts[row.depthRole] ?? 0) + 1;
    }
    const statusKey = row.statusNormalized ?? row.status ?? "MISSING";
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;

    const hasError = issues.some((i) => i.severity === "error");
    const hasWarning = issues.some((i) => i.severity === "warning");
    validated.push({
      ...row,
      issues,
      state: hasError ? "error" : hasWarning ? "warning" : "ready",
    });
  }

  // Soft fuzzy duplicate names (same letters ignoring punctuation)
  const fuzzy = new Map<string, FantasyTrackImportRow[]>();
  for (const row of parsed.rows) {
    if (row.included === false) continue;
    const key = normalizePlayerName(row.playerName).replace(/[^a-z0-9]/g, "");
    if (!key) continue;
    const list = fuzzy.get(key) ?? [];
    list.push(row);
    fuzzy.set(key, list);
  }
  for (const [, group] of fuzzy) {
    if (group.length < 2) continue;
    // Already caught exact duplicates; only warn if names differ in punctuation
    const distinct = new Set(group.map((g) => g.playerName.trim()));
    if (distinct.size > 1) {
      for (const g of group) {
        warnings.push({
          severity: "warning",
          row: g.sourceRowNumber,
          field: "playerName",
          message: "Possible duplicate player with slightly different spelling",
          code: "FUZZY_DUPLICATE",
        });
      }
    }
  }

  if (options?.expectedRoles?.length) {
    for (const team of teams) {
      const teamRows = parsed.rows.filter((r) => r.included !== false && r.team === team);
      for (const role of options.expectedRoles) {
        if (!teamRows.some((r) => (r.depthRole ?? "").toUpperCase() === role.toUpperCase())) {
          warnings.push({
            severity: "warning",
            message: `Team ${team} is missing expected role ${role}`,
            code: "MISSING_TEAM_ROLE",
          });
        }
      }
    }
  }

  compareMetadata(parsed.metadata, contest, warnings);

  // Projection vs rank inconsistency (top ranks should generally have higher projections)
  const withProj = validated
    .filter((r) => r.included !== false && r.rank != null && r.projectedPoints != null)
    .slice()
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  for (let i = 1; i < withProj.length; i++) {
    const prev = withProj[i - 1];
    const curr = withProj[i];
    if (
      prev.projectedPoints != null &&
      curr.projectedPoints != null &&
      curr.rank != null &&
      prev.rank != null &&
      curr.rank > prev.rank &&
      curr.projectedPoints > prev.projectedPoints + 0.05
    ) {
      warnings.push({
        severity: "warning",
        row: curr.sourceRowNumber,
        message: `Projection ranking and numeric rank appear inconsistent (${curr.playerName} projects higher than ${prev.playerName} but ranks worse)`,
        code: "RANK_PROJECTION_INCONSISTENT",
      });
    }
  }

  const readyCount = validated.filter(
    (r) => r.included !== false && r.state !== "error"
  ).length;
  const includedCount = validated.filter((r) => r.included !== false).length;
  const errorCount = errors.length;
  const warningCount = warnings.length;

  let message = "";
  if (errorCount === 0 && warningCount === 0) {
    message = `Import valid — ${readyCount} of ${includedCount} rows ready`;
  } else if (errorCount === 0) {
    message = `${readyCount} rows ready · ${warningCount} warning${warningCount === 1 ? "" : "s"}`;
  } else {
    message = `${readyCount} rows ready · ${warningCount} warning${warningCount === 1 ? "" : "s"} · ${errorCount} blocking error${errorCount === 1 ? "" : "s"}`;
  }

  return {
    rows: validated,
    errors,
    warnings,
    summary: {
      parsedCount: parsed.rows.length,
      readyCount,
      warningCount,
      errorCount,
      teamCount: teams.size,
      roleCounts,
      statusCounts,
      message,
    },
  };
}

function compareMetadata(
  metadata: FantasyTrackImportMetadata,
  contest: ContestImportContext | null | undefined,
  warnings: FantasyTrackImportIssue[]
) {
  if (!contest) return;

  const checks: Array<{
    metaKey: keyof FantasyTrackImportMetadata;
    contestValue: string | number | null | undefined;
    label: string;
  }> = [
    { metaKey: "contestType", contestValue: contest.contestType, label: "contestType" },
    { metaKey: "season", contestValue: contest.season, label: "season" },
    { metaKey: "week", contestValue: contest.week, label: "week" },
    { metaKey: "scoring", contestValue: contest.scoringFormat, label: "scoring" },
    { metaKey: "slate", contestValue: contest.slate, label: "slate" },
  ];

  for (const check of checks) {
    const metaVal = metadata[check.metaKey];
    if (metaVal == null || check.contestValue == null || check.contestValue === "") continue;
    const a = String(metaVal).toUpperCase();
    const b = String(check.contestValue).toUpperCase();
    if (a !== b) {
      warnings.push({
        severity: "warning",
        field: check.label,
        message: `Import metadata ${check.label} (${metaVal}) differs from contest (${check.contestValue})`,
        code: "METADATA_MISMATCH",
      });
    }
  }

  if (metadata.sport && contest.sport) {
    const metaSport = String(metadata.sport).toUpperCase();
    const contestSport = String(contest.sport).toUpperCase();
    const compatible =
      metaSport === contestSport ||
      (metaSport === "NFL" && contestSport === "FOOTBALL") ||
      (metaSport === "FOOTBALL" && contestSport === "NFL");
    if (!compatible) {
      warnings.push({
        severity: "warning",
        field: "sport",
        message: `Import sport (${metadata.sport}) differs from contest sport (${contest.sport})`,
        code: "METADATA_MISMATCH",
      });
    }
  }
}

export function canImport(errors: FantasyTrackImportIssue[]): boolean {
  return !errors.some((e) => e.severity === "error");
}
