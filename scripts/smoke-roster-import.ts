import { PrismaClient, ContestStatus } from "@prisma/client";
import { WEEK1_RB_SAMPLE_IMPORT } from "../lib/roster-import/fixtures/week1-rb-sample";
import { importFantasyTrackRoster } from "../lib/roster-import/import";
import { normalizeStatus } from "../lib/roster-import/normalize";
import { parseFantasyTrackImport } from "../lib/roster-import/parse";
import { expectedRolesFromPreset } from "../lib/roster-import/prompt";
import { canImport, validateFantasyTrackImport } from "../lib/roster-import/validate";
import type { EditableImportRow } from "../lib/roster-import/types";

const prisma = new PrismaClient();

async function main() {
  const seriesId = "cmmpoyw3t0suppl3qc2krwcnx"; // BetaTest2
  const adminId = "cmmkp9l350000veurlv1p935d";

  const contest = await prisma.contest.create({
    data: {
      seriesId,
      title: "NFL 2026 Week 1 RB Race (Import Smoke Test)",
      sport: "FOOTBALL",
      startTime: new Date("2026-09-13T17:00:00.000Z"),
      status: ContestStatus.PUBLISHED,
      publishedAt: new Date(),
      contestType: "POSITION_WEEKLY",
      season: 2026,
      week: 1,
      scoringFormat: "PPR",
      slate: "SUNDAY_AFTERNOON",
      marketMode: "PURE_POOL",
      trackConditions: "GAME_DAY",
    },
  });
  console.log("CREATED_CONTEST", contest.id);

  const parsed = parseFantasyTrackImport(WEEK1_RB_SAMPLE_IMPORT);
  const validated = validateFantasyTrackImport(
    parsed,
    {
      contestType: contest.contestType,
      sport: contest.sport,
      season: contest.season,
      week: contest.week,
      scoringFormat: contest.scoringFormat,
      slate: contest.slate,
    },
    { expectedRoles: expectedRolesFromPreset("RB:RB1_RB2") }
  );

  const buckyRow = parsed.rows.find((r) => r.playerName === "Bucky Irving");
  console.log(
    "PARSE_SUMMARY",
    JSON.stringify(
      {
        rows: parsed.rows.length,
        teams: validated.summary.teamCount,
        roleCounts: validated.summary.roleCounts,
        statusCounts: validated.summary.statusCounts,
        ready: validated.summary.readyCount,
        warnings: validated.summary.warningCount,
        errors: validated.summary.errorCount,
        message: validated.summary.message,
        canImport: canImport(validated.errors),
        buckyWarning: validated.warnings.some(
          (w) => w.row === buckyRow?.sourceRowNumber && w.code === "NON_ACTIVE_STATUS"
        ),
      },
      null,
      2
    )
  );

  const editable: EditableImportRow[] = parsed.rows
    .filter((r) => r.playerName !== "Samaje Perine")
    .map((r, idx) => {
      const statusInfo = normalizeStatus(r.status);
      const base: EditableImportRow = {
        ...r,
        clientId: `c${idx}`,
        included: true,
        statusNormalized: statusInfo.normalized,
      };
      if (r.playerName === "Jahmyr Gibbs") {
        return {
          ...base,
          projectedPoints: 21.1,
          notes: "Edited lead back — smoke test",
        };
      }
      return base;
    });

  const first = await importFantasyTrackRoster({
    contestId: contest.id,
    rawText: WEEK1_RB_SAMPLE_IMPORT,
    rows: editable,
    duplicateMode: "SKIP",
    importedByUserId: adminId,
    expectedRoles: expectedRolesFromPreset("RB:RB1_RB2"),
  });
  console.log("FIRST_IMPORT", JSON.stringify(first, null, 2));

  const lanes = await prisma.lane.findMany({
    where: { contestId: contest.id },
    orderBy: [{ displayOrder: "asc" }, { seedRank: "asc" }],
  });
  const gibbs = lanes.find((l) => l.name === "Jahmyr Gibbs");
  const perine = lanes.find((l) => l.name === "Samaje Perine");
  const bucky = lanes.find((l) => l.name === "Bucky Irving");
  console.log(
    "LANE_COUNTS",
    JSON.stringify(
      {
        total: lanes.length,
        teams: new Set(lanes.map((l) => l.team)).size,
        rb1: lanes.filter((l) => l.depthRole === "RB1").length,
        rb2: lanes.filter((l) => l.depthRole === "RB2").length,
        allHaveSeed: lanes.every((l) => l.seedRank != null),
        allHaveDisplay: lanes.every((l) => l.displayOrder != null),
        allHaveOpp: lanes.every((l) => !!l.opponent),
        allHaveDepth: lanes.every((l) => !!l.depthRole),
        openingOddsNull: lanes.every((l) => l.openingWinOddsTo1 == null),
        firstThree: lanes.slice(0, 3).map((l) => ({
          name: l.name,
          seedRank: l.seedRank,
          displayOrder: l.displayOrder,
          projectedPoints: l.projectedPoints,
        })),
      },
      null,
      2
    )
  );
  console.log("GIBBS", JSON.stringify(gibbs, null, 2));
  console.log("PERINE_PRESENT", !!perine);
  console.log(
    "BUCKY",
    JSON.stringify(
      {
        status: bucky?.status,
        notes: bucky?.notes,
        projectedPoints: bucky?.projectedPoints,
        seedRank: bucky?.seedRank,
      },
      null,
      2
    )
  );

  const batches = await prisma.contestImportBatch.findMany({
    where: { contestId: contest.id },
  });
  console.log(
    "BATCHES",
    JSON.stringify(
      batches.map((b) => ({
        id: b.id,
        imported: b.importedCount,
        skipped: b.skippedCount,
        updated: b.updatedCount,
        warnings: b.warningCount,
        parsed: b.parsedCount,
      })),
      null,
      2
    )
  );

  const second = await importFantasyTrackRoster({
    contestId: contest.id,
    rawText: WEEK1_RB_SAMPLE_IMPORT,
    rows: editable,
    duplicateMode: "SKIP",
    importedByUserId: adminId,
    expectedRoles: expectedRolesFromPreset("RB:RB1_RB2"),
  });
  console.log("SECOND_IMPORT", JSON.stringify(second, null, 2));

  const laneCountAfter = await prisma.lane.count({ where: { contestId: contest.id } });
  const batchCountAfter = await prisma.contestImportBatch.count({
    where: { contestId: contest.id },
  });
  console.log("AFTER_DUP", JSON.stringify({ laneCountAfter, batchCountAfter }));
  console.log("CONTEST_ID", contest.id);
}

main().finally(() => prisma.$disconnect());
