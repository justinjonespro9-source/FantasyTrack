import bcrypt from "bcryptjs";
import { ContestStatus, Market, PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.settlementSummary.deleteMany();
  await prisma.lane.deleteMany();
  await prisma.shoutout.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.series.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@fantasytrack.local",
      passwordHash: await bcrypt.hash("admin123", 10),
      displayName: "Commissioner",
      realName: "Admin User",
      phone: "555-000-0000",
      isAdmin: true
    }
  });

  const alice = await prisma.user.create({
    data: {
      email: "alice@fantasytrack.local",
      passwordHash: await bcrypt.hash("alice123", 10),
      displayName: "AliceSkates",
      realName: "Alice Demo",
      phone: "555-111-2222"
    }
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@fantasytrack.local",
      passwordHash: await bcrypt.hash("bob123", 10),
      displayName: "BobPlays",
      realName: "Bob Demo",
      phone: "555-333-4444"
    }
  });

  const charlie = await prisma.user.create({
    data: {
      email: "charlie@fantasytrack.local",
      passwordHash: await bcrypt.hash("charlie123", 10),
      displayName: "CharlieTracks",
      realName: "Charlie Demo",
      phone: "555-444-5555"
    }
  });

  const dave = await prisma.user.create({
    data: {
      email: "dave@fantasytrack.local",
      passwordHash: await bcrypt.hash("dave123", 10),
      displayName: "DaveTracks",
      realName: "Dave Demo",
      phone: "555-555-6666"
    }
  });

  const erin = await prisma.user.create({
    data: {
      email: "erin@fantasytrack.local",
      passwordHash: await bcrypt.hash("erin123", 10),
      displayName: "ErinTracks",
      realName: "Erin Demo",
      phone: "555-666-7777"
    }
  });

  const frank = await prisma.user.create({
    data: {
      email: "frank@fantasytrack.local",
      passwordHash: await bcrypt.hash("frank123", 10),
      displayName: "FrankTracks",
      realName: "Frank Demo",
      phone: "555-777-8888"
    }
  });

  const gina = await prisma.user.create({
    data: {
      email: "gina@fantasytrack.local",
      passwordHash: await bcrypt.hash("gina123", 10),
      displayName: "GinaTracks",
      realName: "Gina Demo",
      phone: "555-888-9999"
    }
  });

  const now = new Date();
  const activeSeries = await prisma.series.create({
    data: {
      name: "Week 7 Series",
      startDate: addDays(now, -2),
      endDate: addDays(now, 4),
      prizesText: "Top eligible users earn bragging rights.",
      isActive: true
    }
  });

  const yesterday = await prisma.contest.create({
    data: {
      seriesId: activeSeries.id,
      title: "Wild vs Avalanche — Yesterday",
      sport: "NHL",
      startTime: addDays(now, -1),
      status: ContestStatus.SETTLED,
      publishedAt: addDays(now, -2),
      lockedAt: addDays(now, -1),
      settledAt: addDays(now, -1)
    }
  });

  const today = await prisma.contest.create({
    data: {
      seriesId: activeSeries.id,
      title: "Rangers vs Devils — Tonight",
      sport: "NHL",
      startTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      status: ContestStatus.PUBLISHED,
      publishedAt: now
    }
  });

  await prisma.lane.createMany({
    data: [
      {
        contestId: yesterday.id,
        name: "Connor McDavid",
        team: "EDM",
        position: "C",
        finalRank: 1,
        fantasyPoints: 28.5,
        openingWinOddsTo1: 2
      },
      {
        contestId: yesterday.id,
        name: "Nathan MacKinnon",
        team: "COL",
        position: "C",
        finalRank: 2,
        fantasyPoints: 24.1,
        openingWinOddsTo1: 8
      },
      {
        contestId: yesterday.id,
        name: "Kirill Kaprizov",
        team: "MIN",
        position: "LW",
        finalRank: 3,
        fantasyPoints: 19.7,
        openingWinOddsTo1: 40
      },
      {
        contestId: yesterday.id,
        name: "Cale Makar",
        team: "COL",
        position: "D",
        finalRank: 4,
        fantasyPoints: 16.0,
        openingWinOddsTo1: 50
      }
    ]
  });

  const yesterdayLanes = await prisma.lane.findMany({
    where: { contestId: yesterday.id }
  });

  await prisma.lane.createMany({
    data: [
      { contestId: today.id, name: "Artemi Panarin", team: "NYR", position: "LW", openingWinOddsTo1: 2 },
      { contestId: today.id, name: "Jack Hughes", team: "NJD", position: "C", openingWinOddsTo1: 8 },
      { contestId: today.id, name: "Adam Fox", team: "NYR", position: "D", openingWinOddsTo1: 40 },
      { contestId: today.id, name: "Jesper Bratt", team: "NJD", position: "RW", openingWinOddsTo1: 50 }
    ]
  });

  for (const user of [alice, bob, charlie, dave, erin, frank, gina]) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: TransactionType.GRANT,
        amount: 10000,
        note: "Seed starting balance",
        createdByAdminId: admin.id
      }
    });
  }

  const mcdavid = yesterdayLanes.find((lane) => lane.finalRank === 1)!;
  const mackinnon = yesterdayLanes.find((lane) => lane.finalRank === 2)!;
  const kaprizov = yesterdayLanes.find((lane) => lane.finalRank === 3)!;

  const bet1 = await prisma.bet.create({
    data: {
      userId: alice.id,
      contestId: yesterday.id,
      laneId: mcdavid.id,
      market: Market.WIN,
      amount: 600
    }
  });

  const bet2 = await prisma.bet.create({
    data: {
      userId: alice.id,
      contestId: yesterday.id,
      laneId: kaprizov.id,
      market: Market.SHOW,
      amount: 400
    }
  });

  const bet3 = await prisma.bet.create({
    data: {
      userId: bob.id,
      contestId: yesterday.id,
      laneId: mackinnon.id,
      market: Market.WIN,
      amount: 700
    }
  });

  await prisma.transaction.createMany({
    data: [
      { userId: alice.id, type: TransactionType.BET, amount: -600, seriesId: activeSeries.id, contestId: yesterday.id, betId: bet1.id },
      { userId: alice.id, type: TransactionType.BET, amount: -400, seriesId: activeSeries.id, contestId: yesterday.id, betId: bet2.id },
      { userId: bob.id, type: TransactionType.BET, amount: -700, seriesId: activeSeries.id, contestId: yesterday.id, betId: bet3.id },
      { userId: alice.id, type: TransactionType.PAYOUT, amount: 1300, seriesId: activeSeries.id, contestId: yesterday.id, betId: bet1.id },
      { userId: alice.id, type: TransactionType.PAYOUT, amount: 400, seriesId: activeSeries.id, contestId: yesterday.id, betId: bet2.id }
    ]
  });

  await prisma.settlementSummary.create({
    data: {
      contestId: yesterday.id,
      winPoolTotal: 1300,
      placePoolTotal: 0,
      showPoolTotal: 400,
      winPayoutMultiple: 2.1666666667,
      placePayoutMultiple: 0,
      showPayoutMultiple: 1
    }
  });

  await prisma.shoutout.create({
    data: {
      seriesId: activeSeries.id,
      message: "Tonight's lock is in four hours. WPS is live.",
      createdByAdminId: admin.id,
      contestId: today.id
    }
  });

  console.log("Seed complete.");
  console.log("Admin login: admin@fantasytrack.local / admin123");
  console.log("User login: alice@fantasytrack.local / alice123");
  console.log("User login: bob@fantasytrack.local / bob123");
  console.log("User login: charlie@fantasytrack.local / charlie123");
  console.log("User login: dave@fantasytrack.local / dave123");
  console.log("User login: erin@fantasytrack.local / erin123");
  console.log("User login: frank@fantasytrack.local / frank123");
  console.log("User login: gina@fantasytrack.local / gina123");
}

main()
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
