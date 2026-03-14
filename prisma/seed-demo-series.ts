import {
  PrismaClient,
  ContestStatus,
  TicketStatus,
  TicketResult,
  LegResult,
  Market,
  TransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Use existing demo user if possible
  const demoUser =
    (await prisma.user.findUnique({ where: { email: "alice@fantasytrack.local" } })) ??
    (await prisma.user.findFirst());

  if (!demoUser) {
    console.error("No demo user found. Run seed-users.ts first.");
    return;
  }

  const now = new Date();

  // Helper to shift dates
  const daysFromNow = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  // 1) Strong golf series hub (Series has no unique on name; use findFirst + create)
  let golfSeries = await prisma.series.findFirst({
    where: { name: "Players Championship Golf Demo" },
  });
  if (!golfSeries) {
    golfSeries = await prisma.series.create({
      data: {
        name: "Players Championship Golf Demo",
        startDate: daysFromNow(-1),
        endDate: daysFromNow(3),
        description: "Round-by-round golf performance market demo series.",
        isActive: true,
        prizesText: "Demo-only leaderboard for partner walkthroughs.",
      },
    });
  }

  // Settled golf contest (Contest unique is id or externalProvider_externalId; use findFirst + create)
  let golfSettled = await prisma.contest.findFirst({
    where: { seriesId: golfSeries.id, title: "Golf Demo – Round 1 (Settled)" },
  });
  if (!golfSettled) {
    golfSettled = await prisma.contest.create({
      data: {
        seriesId: golfSeries.id,
        title: "Golf Demo – Round 1 (Settled)",
        sport: "GOLF",
        startTime: daysFromNow(-1),
        status: ContestStatus.SETTLED,
        settledAt: daysFromNow(-0.5),
        trackConditions: "GOOD",
      },
    });
  }

  let golfLive = await prisma.contest.findFirst({
    where: { seriesId: golfSeries.id, title: "Golf Demo – Round 2 (Live)" },
  });
  if (!golfLive) {
    golfLive = await prisma.contest.create({
      data: {
        seriesId: golfSeries.id,
        title: "Golf Demo – Round 2 (Live)",
        sport: "GOLF",
        startTime: daysFromNow(0),
        status: ContestStatus.LOCKED,
        lockedAt: now,
        trackConditions: "GOOD",
      },
    });
  }

  let golfUpcoming1 = await prisma.contest.findFirst({
    where: { seriesId: golfSeries.id, title: "Golf Demo – Round 3 (Upcoming)" },
  });
  if (!golfUpcoming1) {
    golfUpcoming1 = await prisma.contest.create({
      data: {
        seriesId: golfSeries.id,
        title: "Golf Demo – Round 3 (Upcoming)",
        sport: "GOLF",
        startTime: daysFromNow(1),
        status: ContestStatus.PUBLISHED,
        publishedAt: now,
        trackConditions: "GOOD",
      },
    });
  }

  let golfUpcoming2 = await prisma.contest.findFirst({
    where: { seriesId: golfSeries.id, title: "Golf Demo – Final Round (Upcoming)" },
  });
  if (!golfUpcoming2) {
    golfUpcoming2 = await prisma.contest.create({
      data: {
        seriesId: golfSeries.id,
        title: "Golf Demo – Final Round (Upcoming)",
        sport: "GOLF",
        startTime: daysFromNow(2),
        status: ContestStatus.PUBLISHED,
        publishedAt: now,
        trackConditions: "GOOD",
      },
    });
  }

  // Minimal lanes for live golf contest so boards render
  const [golfLane1, golfLane2, golfLane3] = await Promise.all([
    prisma.lane.upsert({
      where: { id: `${golfLive.id}-lane-1` },
      update: {},
      create: {
        id: `${golfLive.id}-lane-1`,
        contestId: golfLive.id,
        name: "Demo Golfer A",
        team: "",
        position: "GOLFER",
        openingWinOddsTo1: 6,
        liveFantasyPoints: 18.5,
      },
    }),
    prisma.lane.upsert({
      where: { id: `${golfLive.id}-lane-2` },
      update: {},
      create: {
        id: `${golfLive.id}-lane-2`,
        contestId: golfLive.id,
        name: "Demo Golfer B",
        team: "",
        position: "GOLFER",
        openingWinOddsTo1: 12,
        liveFantasyPoints: 14.2,
      },
    }),
    prisma.lane.upsert({
      where: { id: `${golfLive.id}-lane-3` },
      update: {},
      create: {
        id: `${golfLive.id}-lane-3`,
        contestId: golfLive.id,
        name: "Demo Golfer C",
        team: "",
        position: "GOLFER",
        openingWinOddsTo1: 25,
        liveFantasyPoints: 9.7,
      },
    }),
  ]);

  // Lanes for settled golf contest with final ranks
  const [golfSettledLane1, golfSettledLane2] = await Promise.all([
    prisma.lane.upsert({
      where: { id: `${golfSettled.id}-lane-1` },
      update: {},
      create: {
        id: `${golfSettled.id}-lane-1`,
        contestId: golfSettled.id,
        name: "Winner Golfer",
        team: "",
        position: "GOLFER",
        openingWinOddsTo1: 8,
        fantasyPoints: 24.3,
        finalRank: 1,
      },
    }),
    prisma.lane.upsert({
      where: { id: `${golfSettled.id}-lane-2` },
      update: {},
      create: {
        id: `${golfSettled.id}-lane-2`,
        contestId: golfSettled.id,
        name: "Runner-up Golfer",
        team: "",
        position: "GOLFER",
        openingWinOddsTo1: 10,
        fantasyPoints: 20.1,
        finalRank: 2,
      },
    }),
  ]);

  // 2) Smaller second-sport series (e.g., Hockey)
  let hockeySeries = await prisma.series.findFirst({
    where: { name: "Saturday Hockey Spotlight" },
  });
  if (!hockeySeries) {
    hockeySeries = await prisma.series.create({
      data: {
        name: "Saturday Hockey Spotlight",
        startDate: daysFromNow(-1),
        endDate: daysFromNow(1),
        description: "Compact hockey series to showcase multi-sport support.",
        isActive: true,
        prizesText: "Demo spotlight for partner walkthroughs.",
      },
    });
  }

  let hockeySettled = await prisma.contest.findFirst({
    where: { seriesId: hockeySeries.id, title: "Hockey Demo – Night 1 (Settled)" },
  });
  if (!hockeySettled) {
    hockeySettled = await prisma.contest.create({
      data: {
        seriesId: hockeySeries.id,
        title: "Hockey Demo – Night 1 (Settled)",
        sport: "HOCKEY",
        startTime: daysFromNow(-1),
        status: ContestStatus.SETTLED,
        settledAt: daysFromNow(-0.5),
        trackConditions: "COLD_ICY",
      },
    });
  }

  let hockeyUpcoming = await prisma.contest.findFirst({
    where: { seriesId: hockeySeries.id, title: "Hockey Demo – Night 2 (Upcoming)" },
  });
  if (!hockeyUpcoming) {
    hockeyUpcoming = await prisma.contest.create({
      data: {
        seriesId: hockeySeries.id,
        title: "Hockey Demo – Night 2 (Upcoming)",
        sport: "HOCKEY",
        startTime: daysFromNow(1),
        status: ContestStatus.PUBLISHED,
        publishedAt: now,
        trackConditions: "COLD_ICY",
      },
    });
  }

  // Simple lanes for hockey settled contest
  const hockeyLane1 = await prisma.lane.upsert({
    where: { id: `${hockeySettled.id}-lane-1` },
    update: {},
    create: {
      id: `${hockeySettled.id}-lane-1`,
      contestId: hockeySettled.id,
      name: "Star Winger",
      team: "Demo HC",
      position: "F",
      openingWinOddsTo1: 4,
      fantasyPoints: 19.4,
      finalRank: 1,
    },
  });

  // 3) Demo tickets for the demo user
  // One ticket in each contest state
  const demoTickets: { contestId: string; laneId: string; status: TicketStatus; result: TicketResult }[] =
    [
      { contestId: golfUpcoming1.id, laneId: golfLane1.id, status: TicketStatus.SUBMITTED, result: TicketResult.PENDING },
      { contestId: golfLive.id, laneId: golfLane2.id, status: TicketStatus.LOCKED, result: TicketResult.PENDING },
      { contestId: golfSettled.id, laneId: golfSettledLane1.id, status: TicketStatus.SETTLED, result: TicketResult.WON },
      { contestId: hockeySettled.id, laneId: hockeyLane1.id, status: TicketStatus.SETTLED, result: TicketResult.LOST },
    ];

  for (const t of demoTickets) {
    const ticket = await prisma.ticket.create({
      data: {
        userId: demoUser.id,
        seriesId: golfSeries.id,
        contestId: t.contestId,
        status: t.status,
        result: t.result,
        stakeAmount: 500,
        payoutAmount: t.result === TicketResult.WON ? 2500 : null,
        netAmount: t.result === TicketResult.WON ? 2000 : t.result === TicketResult.LOST ? -500 : null,
      },
    });

    await prisma.ticketLeg.create({
      data: {
        ticketId: ticket.id,
        userId: demoUser.id,
        contestId: t.contestId,
        laneId: t.laneId,
        market: Market.WIN,
        amount: 500,
        laneNameSnap: "Demo selection",
        oddsTo1Snap: 6,
        result: t.result === TicketResult.WON ? LegResult.WON : t.result === TicketResult.LOST ? LegResult.LOST : LegResult.PENDING,
      },
    });
  }

  // 4) Badge demo block – extend the demo user with more settled contests/tickets
  // so profile auto-badges (Contest Regular, Ticket Volume, Sharp Sessions, Profitable Player) can appear.
  const badgeContestSpecs: { title: string; sport: string; seriesId: string; track: string; isWin: boolean }[] =
    [
      { title: "Golf Demo – Badge Round 1", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 2", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 3", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 4", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 5", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 6", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Golf Demo – Badge Round 7", sport: "GOLF", seriesId: golfSeries.id, track: "GOOD", isWin: true },
      { title: "Hockey Demo – Badge Night 1", sport: "HOCKEY", seriesId: hockeySeries.id, track: "COLD_ICY", isWin: false },
      { title: "Hockey Demo – Badge Night 2", sport: "HOCKEY", seriesId: hockeySeries.id, track: "COLD_ICY", isWin: false },
      { title: "Hockey Demo – Badge Night 3", sport: "HOCKEY", seriesId: hockeySeries.id, track: "COLD_ICY", isWin: false },
    ];

  const badgeContests = await Promise.all(
    badgeContestSpecs.map(async (spec, index) => {
      const existing = await prisma.contest.findFirst({
        where: { seriesId: spec.seriesId, title: spec.title },
      });
      if (existing) return existing;
      return prisma.contest.create({
        data: {
          seriesId: spec.seriesId,
          title: spec.title,
          sport: spec.sport,
          startTime: daysFromNow(-3 - index),
          status: ContestStatus.SETTLED,
          settledAt: daysFromNow(-2 - index),
          trackConditions: spec.track,
        },
      });
    })
  );

  // Minimal single lane per badge contest
  const badgeLanes = await Promise.all(
    badgeContests.map((contest, index) =>
      prisma.lane.upsert({
        where: { id: `${contest.id}-badge-lane-1` },
        update: {},
        create: {
          id: `${contest.id}-badge-lane-1`,
          contestId: contest.id,
          name: `Badge Demo Runner ${index + 1}`,
          team: "",
          position: "GOLFER",
          openingWinOddsTo1: 8 + index,
          fantasyPoints: 20 + index,
          finalRank: 1,
        },
      })
    )
  );

  // For each badge contest, create 2 tickets + matching BET / PAYOUT transactions for the demo user.
  for (let i = 0; i < badgeContests.length; i++) {
    const contest = badgeContests[i];
    const lane = badgeLanes[i];
    const spec = badgeContestSpecs[i];

    const isWinningContest = spec.isWin;
    const stakePerTicket = 20;
    const payoutPerTicket = isWinningContest ? 35 : 0;

    for (let t = 0; t < 2; t++) {
      const ticket = await prisma.ticket.create({
        data: {
          userId: demoUser.id,
          seriesId: spec.seriesId,
          contestId: contest.id,
          status: TicketStatus.SETTLED,
          result: isWinningContest ? TicketResult.WON : TicketResult.LOST,
          stakeAmount: stakePerTicket,
          payoutAmount: payoutPerTicket > 0 ? payoutPerTicket : null,
          netAmount: payoutPerTicket - stakePerTicket,
        },
      });

      const leg = await prisma.ticketLeg.create({
        data: {
          ticketId: ticket.id,
          userId: demoUser.id,
          contestId: contest.id,
          laneId: lane.id,
          market: Market.WIN,
          amount: stakePerTicket,
          laneNameSnap: lane.name,
          oddsTo1Snap: lane.openingWinOddsTo1,
          result: isWinningContest ? LegResult.WON : LegResult.LOST,
        },
      });

      // BET transaction (negative amount)
      await prisma.transaction.create({
        data: {
          userId: demoUser.id,
          type: TransactionType.BET,
          amount: -stakePerTicket,
          seriesId: spec.seriesId,
          contestId: contest.id,
          ticketId: ticket.id,
          ticketLegId: leg.id,
        },
      });

      // PAYOUT transaction for winning contests
      if (payoutPerTicket > 0) {
        await prisma.transaction.create({
          data: {
            userId: demoUser.id,
            type: TransactionType.PAYOUT,
            amount: payoutPerTicket,
            seriesId: spec.seriesId,
            contestId: contest.id,
            ticketId: ticket.id,
            ticketLegId: leg.id,
          },
        });
      }
    }
  }

  // 5) Commish Notes (global shoutouts) – Shoutout uses seriesId and createdByAdminId
  await prisma.shoutout.createMany({
    data: [
      {
        seriesId: golfSeries.id,
        message: "Players Championship Golf Demo series is live – follow the Round 2 leaderboard.",
        contestId: golfLive.id,
        createdByAdminId: demoUser.id,
      },
      {
        seriesId: hockeySeries.id,
        message: "Saturday Hockey Spotlight settles tonight. Check the recap after final horn.",
        contestId: hockeySettled.id,
        createdByAdminId: demoUser.id,
      },
      {
        seriesId: golfSeries.id,
        message: "Upcoming golf rounds are seeded with demo odds for partner walkthroughs.",
        contestId: golfUpcoming1.id,
        createdByAdminId: demoUser.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Demo series, contests, lanes, tickets, and commish notes seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

