/**
 * One-off production verification for roster-import schema.
 * Uses DATABASE_URL / DATABASE_URL_UNPOOLED from the environment.
 */
import { ContestStatus, PrismaClient } from "@prisma/client";
import { WEEK1_RB_SAMPLE_IMPORT } from "../lib/roster-import/fixtures/week1-rb-sample";
import { importFantasyTrackRoster } from "../lib/roster-import/import";

const prisma = new PrismaClient();

async function main() {
  const series = await prisma.series.findFirst({ orderBy: { createdAt: "asc" } });
  if (!series) throw new Error("No series");
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin");

  const contest = await prisma.contest.create({
    data: {
      seriesId: series.id,
      title: "PROD VERIFY NFL Week 1 RB Race",
      sport: "FOOTBALL",
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: ContestStatus.DRAFT,
      contestType: "POSITION_WEEKLY",
      season: 2026,
      week: 1,
      scoringFormat: "PPR",
      slate: "SUNDAY_AFTERNOON",
      marketMode: "PURE_POOL",
      trackConditions: "GAME_DAY",
    },
  });

  const result = await importFantasyTrackRoster({
    contestId: contest.id,
    rawText: WEEK1_RB_SAMPLE_IMPORT,
    duplicateMode: "UPDATE",
    importedByUserId: admin.id,
  });

  const lanes = await prisma.lane.count({ where: { contestId: contest.id } });
  const batches = await prisma.contestImportBatch.count({
    where: { contestId: contest.id },
  });
  const withCols = await prisma.contest.findUnique({
    where: { id: contest.id },
    select: { contestType: true, week: true, slate: true },
  });

  const published = await prisma.contest.findFirst({
    where: { status: ContestStatus.PUBLISHED },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let publicCheck = null;
  if (published) {
    const res = await fetch(`https://www.fantasytrack.app/contest/${published.id}`);
    const body = await res.text();
    publicCheck = {
      publishedContestHttp: res.status,
      p2022: /P2022|contestType does not exist/i.test(body),
    };
  }

  console.log(
    JSON.stringify(
      {
        contestId: contest.id,
        importSuccess: result.success,
        importedCount: result.importedCount,
        errors: result.errors?.slice(0, 3),
        lanes,
        batches,
        contestType: withCols?.contestType,
        week: withCols?.week,
        publicCheck,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
