import { ContestStatus, PrismaClient } from "@prisma/client";
import { WEEK1_RB_SAMPLE_IMPORT } from "../lib/roster-import/fixtures/week1-rb-sample";
import { importFantasyTrackRoster } from "../lib/roster-import/import";
import { normalizeStatus } from "../lib/roster-import/normalize";
import { parseFantasyTrackImport } from "../lib/roster-import/parse";

const prisma = new PrismaClient();

async function main() {
  const contest = await prisma.contest.create({
    data: {
      seriesId: "cmmpoyw3t0suppl3qc2krwcnx",
      title: "NFL 2026 Week 1 RB Race (Empty Pool Preview)",
      sport: "FOOTBALL",
      startTime: new Date("2026-09-13T18:00:00.000Z"),
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

  const parsed = parseFantasyTrackImport(WEEK1_RB_SAMPLE_IMPORT);
  const rows = parsed.rows.map((r, idx) => ({
    ...r,
    clientId: `e${idx}`,
    included: true,
    statusNormalized: normalizeStatus(r.status).normalized,
  }));

  const result = await importFantasyTrackRoster({
    contestId: contest.id,
    rawText: `${WEEK1_RB_SAMPLE_IMPORT}\n# empty-pool-preview`,
    rows,
    duplicateMode: "SKIP",
    importedByUserId: "cmmkp9l350000veurlv1p935d",
  });

  console.log(JSON.stringify({ contestId: contest.id, result }, null, 2));
}

main().finally(() => prisma.$disconnect());
