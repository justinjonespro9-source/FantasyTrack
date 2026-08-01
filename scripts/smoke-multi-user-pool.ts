/**
 * Multi-user pool QA for NFL weekly position contests.
 * Places free-play entries across 5+ players from several seed users,
 * then verifies market vs projected ordering and lock snapshots.
 */
import { ContestStatus, Market, PrismaClient } from "@prisma/client";
import { WEEK1_RB_SAMPLE_IMPORT } from "../lib/roster-import/fixtures/week1-rb-sample";
import { importFantasyTrackRoster } from "../lib/roster-import/import";
import { getContestOddsData, snapshotClosingOddsForContest } from "../lib/market";
import { placeTicket } from "../lib/tickets/placeTicket";

const prisma = new PrismaClient();

async function main() {
  const series = await prisma.series.findFirst({
    where: { name: "BetaTest2" },
  }) ?? (await prisma.series.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!series) throw new Error("No series found");

  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user");

  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@fantasytrack.local" }, isAdmin: false },
    orderBy: { email: "asc" },
    take: 6,
  });
  if (users.length < 5) throw new Error(`Need >=5 seed users, found ${users.length}`);

  const contest = await prisma.contest.create({
    data: {
      seriesId: series.id,
      title: "QA NFL Week 1 Sunday RB Race",
      sport: "FOOTBALL",
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
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

  const imported = await importFantasyTrackRoster({
    contestId: contest.id,
    rawText: WEEK1_RB_SAMPLE_IMPORT,
    duplicateMode: "UPDATE",
    importedByUserId: admin.id,
  });
  if (!imported.success) {
    throw new Error(`Import failed: ${JSON.stringify(imported.errors)}`);
  }

  const lanes = await prisma.lane.findMany({
    where: { contestId: contest.id },
    orderBy: [{ seedRank: "asc" }, { displayOrder: "asc" }],
    select: {
      id: true,
      name: true,
      seedRank: true,
      displayOrder: true,
      openingWinOddsTo1: true,
      projectedPoints: true,
    },
    take: 8,
  });
  if (lanes.length < 5) throw new Error("Need >=5 lanes");

  const emptyOdds = await getContestOddsData(contest.id);
  if (!emptyOdds) throw new Error("Empty odds missing");
  const emptyPool =
    (emptyOdds.poolTotals.WIN ?? 0) +
    (emptyOdds.poolTotals.PLACE ?? 0) +
    (emptyOdds.poolTotals.SHOW ?? 0);
  if (emptyPool !== 0) throw new Error(`Expected empty pool, got ${emptyPool}`);
  for (const lane of lanes) {
    if (lane.openingWinOddsTo1 != null) {
      throw new Error(`Unexpected opening odds on ${lane.name}`);
    }
    if (emptyOdds.estMultiples[lane.id]?.WIN != null) {
      throw new Error(`Unexpected live odds before entries on ${lane.name}`);
    }
  }

  // Uneven free-play entries so shares and market order diverge from seed rank.
  const stakes: Array<{ userIndex: number; laneIndex: number; amount: number }> = [
    { userIndex: 0, laneIndex: 4, amount: 40 },
    { userIndex: 1, laneIndex: 4, amount: 30 },
    { userIndex: 2, laneIndex: 2, amount: 25 },
    { userIndex: 3, laneIndex: 0, amount: 20 },
    { userIndex: 4, laneIndex: 1, amount: 15 },
    { userIndex: 5, laneIndex: 3, amount: 10 },
    { userIndex: 0, laneIndex: 2, amount: 10 },
    { userIndex: 1, laneIndex: 0, amount: 5 },
  ];

  for (const stake of stakes) {
    await placeTicket({
      userId: users[stake.userIndex].id,
      contestId: contest.id,
      seriesId: series.id,
      stakeAmount: stake.amount,
      legs: [{ laneId: lanes[stake.laneIndex].id, market: Market.WIN }],
    });
  }

  const activeOdds = await getContestOddsData(contest.id);
  if (!activeOdds) throw new Error("Active odds missing");

  const byWin = [...lanes].sort((a, b) => {
    const aAmt = activeOdds.laneTotals[a.id]?.WIN ?? 0;
    const bAmt = activeOdds.laneTotals[b.id]?.WIN ?? 0;
    return bAmt - aAmt;
  });
  const byProjected = [...lanes].sort((a, b) => {
    const aRank = a.seedRank ?? a.displayOrder ?? 9999;
    const bRank = b.seedRank ?? b.displayOrder ?? 9999;
    return aRank - bRank;
  });

  const shares = byWin.map((lane) => {
    const amount = activeOdds.laneTotals[lane.id]?.WIN ?? 0;
    const pool = activeOdds.poolTotals.WIN || 1;
    return {
      name: lane.name,
      seedRank: lane.seedRank,
      amount,
      share: Number(((amount / pool) * 100).toFixed(1)),
      odds: activeOdds.estMultiples[lane.id]?.WIN ?? null,
    };
  });

  const uniqueShares = new Set(shares.map((s) => s.share));
  if (uniqueShares.size < 3) {
    throw new Error(`Expected differing pool shares, got ${JSON.stringify(shares)}`);
  }

  const marketTop = byWin[0].id;
  const projectedTop = byProjected[0].id;
  if (marketTop === projectedTop && shares[0].amount <= shares[1].amount) {
    // soft check — with our stakes lane index 4 should be market favorite
    throw new Error("Expected market favorite to diverge from projected #1");
  }
  if (byWin[0].seedRank === 1) {
    throw new Error("Market ordering still follows projected seed #1 unexpectedly");
  }

  for (const lane of lanes) {
    const multiple = activeOdds.estMultiples[lane.id]?.WIN;
    if ((activeOdds.laneTotals[lane.id]?.WIN ?? 0) > 0 && multiple == null) {
      throw new Error(`Missing odds for backed lane ${lane.name}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await snapshotClosingOddsForContest(contest.id, tx);
    await tx.contest.update({
      where: { id: contest.id },
      data: { status: ContestStatus.LOCKED, lockedAt: new Date() },
    });
  });

  const lockedLanes = await prisma.lane.findMany({
    where: { contestId: contest.id, id: { in: lanes.map((l) => l.id) } },
    select: {
      id: true,
      name: true,
      closingWinOddsTo1: true,
      seedRank: true,
    },
  });

  const withClosing = lockedLanes.filter(
    (l) => (activeOdds.laneTotals[l.id]?.WIN ?? 0) > 0 && l.closingWinOddsTo1 != null
  );
  if (withClosing.length < 3) {
    throw new Error(
      `Expected closing odds snapshots on backed lanes, got ${JSON.stringify(lockedLanes)}`
    );
  }

  // Confirm lock blocks new entries
  let blocked = false;
  try {
    await placeTicket({
      userId: users[0].id,
      contestId: contest.id,
      seriesId: series.id,
      stakeAmount: 5,
      legs: [{ laneId: lanes[0].id, market: Market.WIN }],
    });
  } catch {
    blocked = true;
  }
  if (!blocked) throw new Error("Expected placeTicket to fail after lock");

  console.log(
    JSON.stringify(
      {
        contestId: contest.id,
        emptyPoolOk: true,
        noOpeningOdds: true,
        marketOrder: shares.map((s) => s.name),
        projectedOrder: byProjected.map((l) => l.name),
        shares,
        marketTopDivergesFromProjected: marketTop !== projectedTop,
        closingSnapshots: withClosing.length,
        lockBlockedEntries: blocked,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
