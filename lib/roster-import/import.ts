import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  mapImportSportToContestSport,
  normalizePlayerName,
  normalizePosition,
  normalizeTeamAbbr,
  toLaneStatus,
} from "./normalize";
import { parseFantasyTrackImport } from "./parse";
import { canImport, validateFantasyTrackImport } from "./validate";
import {
  PARSER_VERSION,
  type DuplicateMode,
  type EditableImportRow,
  type FantasyTrackImportRow,
  type RosterImportApiResult,
} from "./types";

export type ImportContestSnapshot = {
  id: string;
  sport: string;
  contestType: string | null;
  season: number | null;
  week: number | null;
  scoringFormat: string | null;
  slate: string | null;
};

function applyEditableOverrides(
  parsedRows: FantasyTrackImportRow[],
  overrides?: EditableImportRow[] | null
): FantasyTrackImportRow[] {
  if (!overrides?.length) {
    return parsedRows.map((r) => ({ ...r, included: r.included !== false }));
  }

  return overrides.map((o, idx) => ({
    sourceRowNumber: o.sourceRowNumber || idx + 1,
    rank: o.rank,
    playerName: o.playerName?.trim() ?? "",
    team: normalizeTeamAbbr(o.team ?? ""),
    opponent: normalizeTeamAbbr(o.opponent ?? ""),
    position: normalizePosition(o.position ?? ""),
    depthRole: o.depthRole?.trim() ? o.depthRole.trim().toUpperCase() : null,
    projectedPoints:
      o.projectedPoints == null || Number.isNaN(Number(o.projectedPoints))
        ? null
        : Number(o.projectedPoints),
    status: o.status,
    statusNormalized: o.statusNormalized,
    notes: o.notes,
    included: o.included !== false,
  }));
}

type PlayerCandidate = Prisma.PlayerGetPayload<{ include: { team: true } }>;

/**
 * Match against an in-memory player cache. Keep DB lookups out of the import
 * transaction so the interactive transaction only performs writes.
 */
function findMatchingPlayer(
  candidates: PlayerCandidate[],
  params: {
    fullName: string;
    position: string;
    teamAbbr: string;
  }
) {
  const normalized = normalizePlayerName(params.fullName);
  const position = normalizePosition(params.position);

  const scoped = position
    ? candidates.filter((p) => normalizePosition(p.position ?? "") === position)
    : candidates;

  const nameMatches = scoped.filter(
    (p) => normalizePlayerName(p.fullName) === normalized
  );

  if (nameMatches.length === 0) {
    return { player: null as PlayerCandidate | null, warning: null as string | null };
  }

  const teamMatches = nameMatches.filter((p) => {
    const abbr = p.team?.abbreviation
      ? normalizeTeamAbbr(p.team.abbreviation)
      : "";
    return abbr && abbr === params.teamAbbr;
  });

  if (teamMatches.length === 1) {
    return { player: teamMatches[0], warning: null };
  }
  if (teamMatches.length > 1) {
    return {
      player: null,
      warning: `Ambiguous player match for ${params.fullName}; creating new player`,
    };
  }

  if (nameMatches.length === 1) {
    const p = nameMatches[0];
    const currentAbbr = p.team?.abbreviation
      ? normalizeTeamAbbr(p.team.abbreviation)
      : "";
    return {
      player: p,
      warning:
        currentAbbr && currentAbbr !== params.teamAbbr
          ? `Player ${params.fullName} matched with different team (${currentAbbr} → ${params.teamAbbr})`
          : null,
    };
  }

  return {
    player: null,
    warning: `Ambiguous player match for ${params.fullName}; creating new player`,
  };
}

export async function importFantasyTrackRoster(params: {
  contestId: string;
  rawText: string;
  rows?: EditableImportRow[] | null;
  duplicateMode: DuplicateMode;
  importedByUserId: string;
  expectedRoles?: string[];
}): Promise<RosterImportApiResult> {
  const contest = await prisma.contest.findUnique({
    where: { id: params.contestId },
    select: {
      id: true,
      sport: true,
      contestType: true,
      season: true,
      week: true,
      scoringFormat: true,
      slate: true,
    },
  });

  if (!contest) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warningCount: 0,
      errors: [{ message: "Contest not found" }],
    };
  }

  if (params.duplicateMode === "CANCEL") {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warningCount: 0,
      errors: [{ message: "Import cancelled" }],
    };
  }

  const existingSameRaw = await prisma.contestImportBatch.findFirst({
    where: {
      contestId: params.contestId,
      rawText: params.rawText,
    },
    select: { id: true },
  });

  if (existingSameRaw) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warningCount: 0,
      errors: [
        {
          message:
            "This exact import text was already imported into this contest. Cancel or change the payload.",
        },
      ],
    };
  }

  const parsed = parseFantasyTrackImport(params.rawText);
  const rows = applyEditableOverrides(parsed.rows, params.rows).filter(
    (r) => r.included !== false
  );

  const validated = validateFantasyTrackImport(
    { ...parsed, rows },
    {
      contestType: contest.contestType,
      sport: contest.sport,
      season: contest.season,
      week: contest.week,
      scoringFormat: contest.scoringFormat,
      slate: contest.slate,
    },
    { expectedRoles: params.expectedRoles }
  );

  if (!canImport(validated.errors)) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warningCount: validated.warnings.length,
      errors: validated.errors.map((e) => ({
        row: e.row,
        field: e.field,
        message: e.message,
      })),
    };
  }

  // Optionally sync contest metadata from import when contest fields are empty
  const metaUpdates: Prisma.ContestUpdateInput = {};
  if (!contest.contestType && parsed.metadata.contestType) {
    metaUpdates.contestType = String(parsed.metadata.contestType);
  }
  if (contest.season == null && parsed.metadata.season != null) {
    metaUpdates.season = Number(parsed.metadata.season);
  }
  if (contest.week == null && parsed.metadata.week != null) {
    metaUpdates.week = Number(parsed.metadata.week);
  }
  if (!contest.scoringFormat && parsed.metadata.scoring) {
    metaUpdates.scoringFormat = String(parsed.metadata.scoring);
  }
  if (!contest.slate && parsed.metadata.slate) {
    metaUpdates.slate = String(parsed.metadata.slate);
  }
  if (
    parsed.metadata.sport &&
    mapImportSportToContestSport(String(parsed.metadata.sport)) &&
    !contest.sport
  ) {
    metaUpdates.sport =
      mapImportSportToContestSport(String(parsed.metadata.sport)) ?? contest.sport;
  }

  const existingLanes = await prisma.lane.findMany({
    where: { contestId: params.contestId },
    select: {
      id: true,
      name: true,
      team: true,
      position: true,
      playerId: true,
      seedRank: true,
      projectedPoints: true,
    },
  });

  const existingByName = new Map(
    existingLanes.map((l) => [normalizePlayerName(l.name), l])
  );

  // Resolve player matches outside the interactive transaction. Previously each
  // new lane ran player.findMany(take: 200) inside the tx and held a pool
  // connection for the entire import.
  const positionsInImport = [
    ...new Set(
      rows
        .map((r) => normalizePosition(r.position))
        .filter((p): p is string => Boolean(p))
    ),
  ];
  const playerCache: PlayerCandidate[] = await prisma.player.findMany({
    where: {
      active: true,
      ...(positionsInImport.length > 0
        ? { position: { in: positionsInImport } }
        : {}),
    },
    include: { team: true },
  });

  let importedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  const runtimeWarnings: string[] = [];

  try {
    const batchId = await prisma.$transaction(async (tx) => {
      if (Object.keys(metaUpdates).length > 0) {
        await tx.contest.update({
          where: { id: contest.id },
          data: metaUpdates,
        });
      }

      const batch = await tx.contestImportBatch.create({
        data: {
          contestId: contest.id,
          importedByUserId: params.importedByUserId,
          rawText: params.rawText,
          parsedMetadata: parsed.metadata as Prisma.InputJsonValue,
          normalizedPayload: {
            rows: validated.rows,
            summary: validated.summary,
          } as Prisma.InputJsonValue,
          sourceLabel: "AI_STRUCTURED_IMPORT",
          parserVersion: PARSER_VERSION,
          parsedCount: validated.summary.parsedCount,
          warningCount: validated.warnings.length,
          errorCount: 0,
        },
      });

      for (const row of rows) {
        const nameKey = normalizePlayerName(row.playerName);
        const existing = existingByName.get(nameKey);

        if (existing) {
          if (params.duplicateMode === "SKIP") {
            skippedCount += 1;
            continue;
          }

          await tx.lane.update({
            where: { id: existing.id },
            data: {
              team: row.team,
              opponent: row.opponent,
              position: row.position,
              depthRole: row.depthRole,
              seedRank: row.rank,
              projectedPoints: row.projectedPoints,
              notes: row.notes,
              displayOrder: row.rank,
              status: toLaneStatus(row.statusNormalized),
              statusUpdatedAt: new Date(),
              importBatchId: batch.id,
              // Never set openingWinOddsTo1 from import
            },
          });
          updatedCount += 1;
          continue;
        }

        const match = findMatchingPlayer(playerCache, {
          fullName: row.playerName,
          position: row.position,
          teamAbbr: row.team,
        });

        if (match.warning) runtimeWarnings.push(match.warning);

        let playerId = match.player?.id ?? null;
        if (!playerId) {
          const created = await tx.player.create({
            data: {
              fullName: row.playerName.trim(),
              position: row.position || null,
              active: true,
            },
          });
          playerId = created.id;
          // Keep later rows in this batch consistent with prior in-tx creates.
          playerCache.push({
            ...created,
            team: null,
          } as PlayerCandidate);
        }

        await tx.lane.create({
          data: {
            contestId: contest.id,
            playerId,
            name: row.playerName.trim(),
            team: row.team,
            opponent: row.opponent,
            position: row.position,
            depthRole: row.depthRole,
            seedRank: row.rank,
            projectedPoints: row.projectedPoints,
            notes: row.notes,
            displayOrder: row.rank,
            status: toLaneStatus(row.statusNormalized),
            statusUpdatedAt: new Date(),
            importBatchId: batch.id,
            openingWinOddsTo1: null,
          },
        });
        importedCount += 1;
      }

      await tx.contestImportBatch.update({
        where: { id: batch.id },
        data: {
          importedCount,
          skippedCount,
          updatedCount,
          warningCount: validated.warnings.length + runtimeWarnings.length,
        },
      });

      return batch.id;
    });

    return {
      success: true,
      importedCount,
      skippedCount,
      updatedCount,
      warningCount: validated.warnings.length + runtimeWarnings.length,
      batchId,
      errors: runtimeWarnings.map((message) => ({ message })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      updatedCount: 0,
      warningCount: validated.warnings.length,
      errors: [{ message }],
    };
  }
}

export async function updateContestImportShell(params: {
  contestId: string;
  contestType?: string | null;
  season?: number | null;
  week?: number | null;
  scoringFormat?: string | null;
  slate?: string | null;
  marketMode?: string | null;
}) {
  return prisma.contest.update({
    where: { id: params.contestId },
    data: {
      contestType: params.contestType || null,
      season: params.season ?? null,
      week: params.week ?? null,
      scoringFormat: params.scoringFormat || null,
      slate: params.slate || null,
      marketMode: params.marketMode || "PURE_POOL",
    },
  });
}
