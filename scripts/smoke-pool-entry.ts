import { Market, PrismaClient } from "@prisma/client";
import { getContestOddsData } from "../lib/market";
import { placeTicket } from "../lib/tickets/placeTicket";

const prisma = new PrismaClient();
const CONTEST_ID = "cmsaxgcan00015cio94zu311a";
const USER_ID = "cmmkp9l5n0001veurfr6b7c58"; // alice

async function main() {
  const before = await getContestOddsData(CONTEST_ID, USER_ID);
  if (!before) throw new Error("odds unavailable before");

  const gibbs = await prisma.lane.findFirst({
    where: { contestId: CONTEST_ID, name: "Jahmyr Gibbs" },
    select: { id: true, openingWinOddsTo1: true, seedRank: true },
  });
  if (!gibbs) throw new Error("Gibbs lane missing");

  console.log(
    "BEFORE",
    JSON.stringify(
      {
        poolTotals: before.poolTotals,
        gibbsMultiple: before.estMultiples[gibbs.id]?.WIN ?? null,
        openingWinOddsTo1: gibbs.openingWinOddsTo1,
        timeToLockSeconds: before.timeToLockSeconds,
        remaining: before.myCoinsRemainingInContest,
      },
      null,
      2
    )
  );

  const contest = await prisma.contest.findUnique({
    where: { id: CONTEST_ID },
    select: { seriesId: true },
  });

  const ticket = await placeTicket({
    userId: USER_ID,
    contestId: CONTEST_ID,
    seriesId: contest?.seriesId ?? null,
    stakeAmount: 10,
    legs: [{ laneId: gibbs.id, market: Market.WIN }],
  });

  const after = await getContestOddsData(CONTEST_ID, USER_ID);
  if (!after) throw new Error("odds unavailable after");

  console.log(
    "AFTER",
    JSON.stringify(
      {
        ticketId: ticket.id,
        poolTotals: after.poolTotals,
        gibbsMultiple: after.estMultiples[gibbs.id]?.WIN ?? null,
        gibbsWinPool: after.laneTotals[gibbs.id]?.WIN ?? 0,
        stillNullOpening: gibbs.openingWinOddsTo1 == null,
        usedOpeningOdds: false,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
