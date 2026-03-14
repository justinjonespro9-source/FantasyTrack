import {
  ContestStatus,
  Market,
  Prisma,
  TransactionType,
  TicketStatus,
  LegResult,
  TicketResult,
  type Contest,
} from "@prisma/client";

import {
  REQUIRED_TOTAL_WAGER_PER_CONTEST,
  SERIES_ELIGIBILITY_MIN_CONTESTS,
  SERIES_ELIGIBILITY_MIN_WAGER,
  LEADERBOARD_MIN_SETTLED_CONTESTS,
  LEADERBOARD_MIN_WAGER,
} from "@/lib/constants";

import { prisma } from "@/lib/prisma";

type MarketNumberMap = Record<Market, number>;
type MarketNullableNumberMap = Record<Market, number | null>;

export class RuleError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type BetInput = {
  laneId: string;
  market: Market;
  amount: number;
};

export type LaneSettlementInput = {
  laneId: string;
  finalRank: number;
  fantasyPoints?: number | null;
};

export type OddsPayload = {
  contestId: string;
  status: ContestStatus;
  startTime: string;
  timeToLockSeconds: number;

  // gross pools (sum of wagers)
  poolTotals: MarketNumberMap;

  // ✅ NEW: rake + net pools for display / estimates
  takeoutTotals: MarketNumberMap;
  netPoolTotals: MarketNumberMap;

  laneTotals: Record<string, MarketNumberMap>;
  estMultiples: Record<string, MarketNullableNumberMap>;
  myCoinsUsedInContest: number;
  myCoinsRemainingInContest: number;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  net: number;
  balance: number;
  totalGranted: number;
  totalWagered: number;
  participatedContests: number;
  settledContests: number;
  podiumFinishes: number;
  roi: number;
  podiumRate: number;
  consistencyRate: number;
  credibilityScore: number;
  skillScore: number;
  eligible: boolean;
};

const SETTLEMENT_FINALIZED_POST_PREFIX = "Settlement finalized.";

const MARKETS: Market[] = [Market.WIN, Market.PLACE, Market.SHOW];
type DbLikeClient = typeof prisma | Prisma.TransactionClient;

// --------------------
// ✅ Rake helpers
// --------------------
const RAKE_RATE = 0.10;

function applyRake(gross: number): { net: number; takeout: number } {
  const takeout = Math.floor(gross * RAKE_RATE);
  const net = Math.max(0, gross - takeout);
  return { net, takeout };
}

function clampMultiple(m: number): number {
  // Do not allow “winner returns less than stake” behavior
  return Math.max(1, m);
}

function zeroMarketMap(): MarketNumberMap {
  return {
    [Market.WIN]: 0,
    [Market.PLACE]: 0,
    [Market.SHOW]: 0,
  };
}

function emptyEstimateMap(): MarketNullableNumberMap {
  return {
    [Market.WIN]: null,
    [Market.PLACE]: null,
    [Market.SHOW]: null,
  };
}

function isContestOpen(contest: Pick<Contest, "status" | "startTime">): boolean {
  return contest.status === ContestStatus.PUBLISHED && new Date() < contest.startTime;
}

// --------------------
// Closing odds snapshot helpers
// --------------------

// odds-to-1 = (netPool / lanePool) - 1 (netPool = grossPool after rake)
// returns null if lanePool is 0
function computeOddsTo1(totalPoolGross: number, lanePool: number): number | null {
  if (lanePool <= 0) return null;
  const { net } = applyRake(totalPoolGross);
  const multiple = clampMultiple(net / lanePool);
  return Number((multiple - 1).toFixed(2));
}

async function snapshotClosingOddsForContest(contestId: string, db: DbLikeClient): Promise<void> {
  // 1) lanes in contest
  const lanes = await db.lane.findMany({
    where: { contestId },
    select: { id: true },
  });
  if (lanes.length === 0) return;

  // 2) sum TicketLeg.amount by laneId + market
  const grouped = await db.ticketLeg.groupBy({
    by: ["laneId", "market"],
    where: {
      contestId,
      isVoided: false,
    },
    _sum: { amount: true },
  });

  // 3) pool totals per market (gross)
  const marketTotals: MarketNumberMap = zeroMarketMap();
  for (const g of grouped) {
    marketTotals[g.market] += g._sum.amount ?? 0;
  }

  // 4) per-lane totals
  const laneTotals: Record<string, MarketNumberMap> = {};
  for (const g of grouped) {
    if (!laneTotals[g.laneId]) laneTotals[g.laneId] = zeroMarketMap();
    laneTotals[g.laneId][g.market] += g._sum.amount ?? 0;
  }

  // 5) write snapshot fields to Lane
  await Promise.all(
    lanes.map((lane) => {
      const pools = laneTotals[lane.id] ?? zeroMarketMap();

      const closingWinOddsTo1 = computeOddsTo1(marketTotals[Market.WIN], pools[Market.WIN]);
      const closingPlaceOddsTo1 = computeOddsTo1(marketTotals[Market.PLACE], pools[Market.PLACE]);
      const closingShowOddsTo1 = computeOddsTo1(marketTotals[Market.SHOW], pools[Market.SHOW]);

      return db.lane.update({
        where: { id: lane.id },
        data: {
          closingWinOddsTo1,
          closingPlaceOddsTo1,
          closingShowOddsTo1,
        },
      });
    })
  );
}

export async function autoLockContests(now = new Date(), db: DbLikeClient = prisma): Promise<void> {
  // 1) Find contests that need locking
  const toLock = await db.contest.findMany({
    where: {
      status: ContestStatus.PUBLISHED,
      startTime: { lte: now },
    },
    select: { id: true, title: true },
  });

  if (toLock.length === 0) return;

  // 2) Find an admin user once (used as "system" author)
  const admin = await db.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });

  // 3) Process each contest so we can snapshot odds BEFORE locking
  for (const c of toLock) {
    const hasTx = typeof (db as any).$transaction === "function";

    if (hasTx) {
      await (db as any).$transaction(async (tdb: DbLikeClient) => {
        // ✅ Snapshot closing odds before locking
        await snapshotClosingOddsForContest(c.id, tdb);

        // ✅ Lock contest
        await tdb.contest.update({
          where: { id: c.id },
          data: { status: ContestStatus.LOCKED, lockedAt: now },
        });

        // ✅ OFFICIAL system post (best effort; lock should still succeed without it)
        if (admin?.id) {
          await tdb.contestPost.create({
            data: {
              contestId: c.id,
              userId: admin.id,
              body: `Contest locked: ${c.title}. No more edits — bets are live.`,
              isCommish: true,
            },
          });
        }
      });
    } else {
      // Fallback without transaction
      await snapshotClosingOddsForContest(c.id, db);

      await db.contest.update({
        where: { id: c.id },
        data: { status: ContestStatus.LOCKED, lockedAt: now },
      });

      if (admin?.id) {
        await db.contestPost.create({
          data: {
            contestId: c.id,
            userId: admin.id,
            body: `Contest locked: ${c.title}. No more edits — bets are live.`,
            isCommish: true,
          },
        });
      }
    }
  }
}

export async function getRecentTicketsForUser(userId: string, take = 50) {
  return prisma.ticket.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take,
    include: {
      contest: { select: { title: true } },
      legs: {
        orderBy: { id: "asc" },
        include: {
          lane: { select: { name: true } },
          transactions: {
            where: { type: TransactionType.BET },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function getUserWalletSummary(userId: string): Promise<{
  balance: number;
  totalGranted: number;
  net: number;
}> {
  const [balanceAgg, grantAgg] = await prisma.$transaction([
    prisma.transaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.GRANT,
      },
      _sum: { amount: true },
    }),
  ]);

  const balance = balanceAgg._sum.amount ?? 0;
  const totalGranted = grantAgg._sum.amount ?? 0;

  return {
    balance,
    totalGranted,
    net: balance - totalGranted,
  };
}

function buildTotalsFromTickets(
  tickets: Array<{ stakeAmount: number; legs: Array<{ laneId: string; market: Market }> }>
) {
  const poolTotals: Record<Market, number> = {
    [Market.WIN]: 0,
    [Market.PLACE]: 0,
    [Market.SHOW]: 0,
  };

  const laneTotals: Record<string, Record<Market, number>> = {};

  for (const t of tickets) {
    const legs = t.legs ?? [];
    if (legs.length === 0) continue;

    // IMPORTANT: stakeAmount is total cost (WPS = amount*3).
    // Each leg should contribute an equal share.
    const perLeg = Math.floor((t.stakeAmount ?? 0) / legs.length);

    for (const leg of legs) {
      if (!laneTotals[leg.laneId]) {
        laneTotals[leg.laneId] = {
          [Market.WIN]: 0,
          [Market.PLACE]: 0,
          [Market.SHOW]: 0,
        };
      }

      laneTotals[leg.laneId][leg.market] += perLeg;
      poolTotals[leg.market] += perLeg;
    }
  }

  return { poolTotals, laneTotals };
}

export async function getContestOddsData(
  contestId: string,
  userId?: string | null
): Promise<OddsPayload | null> {
  await autoLockContests();

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { lanes: { select: { id: true } } },
  });

  if (!contest) return null;

  // ✅ Pull BET transactions tied to NON-VOIDED ticket legs only
  const betTxs = await prisma.transaction.findMany({
    where: {
      contestId,
      type: TransactionType.BET,
      ticketLegId: { not: null },
      ticketLeg: {
        isVoided: false,
      },
    },
    select: {
      amount: true, // negative
      ticketLeg: {
        select: {
          laneId: true,
          market: true,
        },
      },
    },
  });

  const poolTotals = zeroMarketMap(); // gross
  const laneTotals: Record<string, MarketNumberMap> = {};
  const estMultiples: Record<string, MarketNullableNumberMap> = {};

  for (const lane of contest.lanes) {
    laneTotals[lane.id] = zeroMarketMap();
    estMultiples[lane.id] = emptyEstimateMap();
  }

  for (const tx of betTxs) {
    const leg = tx.ticketLeg;
    if (!leg) continue;

    const wager = Math.abs(tx.amount);
    poolTotals[leg.market] += wager;

    if (!laneTotals[leg.laneId]) {
      laneTotals[leg.laneId] = zeroMarketMap();
      estMultiples[leg.laneId] = emptyEstimateMap();
    }
    laneTotals[leg.laneId][leg.market] += wager;
  }

  // ✅ compute rake + net pools
  const takeoutTotals = zeroMarketMap();
  const netPoolTotals = zeroMarketMap();
  for (const market of MARKETS) {
    const { net, takeout } = applyRake(poolTotals[market]);
    takeoutTotals[market] = takeout;
    netPoolTotals[market] = net;
  }

  // ✅ estimate multiples using NET pool (after takeout), clamped to >= 1.00x
  for (const laneId of Object.keys(laneTotals)) {
    for (const market of MARKETS) {
      const laneTotal = laneTotals[laneId][market];
      estMultiples[laneId][market] =
        laneTotal > 0 ? clampMultiple(netPoolTotals[market] / laneTotal) : null;
    }
  }

  let myCoinsUsedInContest = 0;
  let myCoinsRemainingInContest = 0;

  if (userId) {
    // ✅ Net contest exposure = BET (negative) + VOID_REFUND (positive)
    const myNetAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        contestId,
        type: { in: [TransactionType.BET, TransactionType.VOID_REFUND] },
      },
      _sum: { amount: true },
    });

    const myNetContestAmount = myNetAgg._sum.amount ?? 0;

    // BETs are negative, refunds are positive.
    // If net is -70, they've used 70.
    myCoinsUsedInContest = Math.max(0, -myNetContestAmount);

    myCoinsRemainingInContest = Math.max(
      0,
      REQUIRED_TOTAL_WAGER_PER_CONTEST - myCoinsUsedInContest
    );
  }

  return {
    contestId: contest.id,
    status: contest.status,
    startTime: contest.startTime.toISOString(),
    timeToLockSeconds: Math.max(
      0,
      Math.floor((contest.startTime.getTime() - Date.now()) / 1000)
    ),
    poolTotals,
    takeoutTotals,
    netPoolTotals,
    laneTotals,
    estMultiples,
    myCoinsUsedInContest,
    myCoinsRemainingInContest,
  };
}

/* ---------------------------
   Dead-heat settlement helpers
--------------------------- */

// WIN = 1 slot, PLACE = 2 slots, SHOW = 3 slots.
function slotsForMarket(market: Market): number {
  switch (market) {
    case Market.WIN:
      return 1;
    case Market.PLACE:
      return 2;
    case Market.SHOW:
      return 3;
    default:
      return 1;
  }
}

function buildRankGroups(lanes: Array<{ laneId: string; finalRank: number }>) {
  const byRank = new Map<number, string[]>();
  for (const l of lanes) {
    const arr = byRank.get(l.finalRank) ?? [];
    arr.push(l.laneId);
    byRank.set(l.finalRank, arr);
  }

  return [...byRank.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, laneIds]) => ({ rank, laneIds, size: laneIds.length }));
}

/**
 * Returns laneShare[market][laneId] = coins allocated from that market pool to that lane.
 * Dead-heat slot pooling:
 * - pool split into S equal slots (S = 1/2/3)
 * - finishing groups consume `size` places
 * - a group gets the sum of any slots it covers (within top S)
 * - that group pot is split evenly across lanes in the tie group
 */
function computeLaneSharesByMarket(
  lanes: Array<{ laneId: string; finalRank: number }>,
  poolTotals: MarketNumberMap
): Record<Market, Map<string, number>> {
  const result: Record<Market, Map<string, number>> = {
    [Market.WIN]: new Map(),
    [Market.PLACE]: new Map(),
    [Market.SHOW]: new Map(),
  };

  const groups = buildRankGroups(lanes);

  for (const market of [Market.WIN, Market.PLACE, Market.SHOW] as const) {
    const pool = poolTotals[market];
    const slots = slotsForMarket(market);
    const slotValue = slots > 0 ? pool / slots : 0;

    let currentPlace = 1;

    for (const g of groups) {
      const groupStart = currentPlace;
      const groupEnd = currentPlace + g.size - 1;

      const overlapStart = Math.max(groupStart, 1);
      const overlapEnd = Math.min(groupEnd, slots);

      const covered = overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0;
      const groupPot = covered * slotValue;

      if (groupPot > 0) {
        const each = groupPot / g.size;
        for (const laneId of g.laneIds) {
          result[market].set(laneId, (result[market].get(laneId) ?? 0) + each);
        }
      }

      currentPlace += g.size;
      if (currentPlace > slots) break;
    }
  }

  return result;
}

export async function settleContestAtomic(params: {
  contestId: string;
  adminId: string;
  lanes: LaneSettlementInput[];
}) {
  const { contestId, adminId, lanes } = params;

  return prisma.$transaction(
    async (tx) => {
      await autoLockContests(new Date(), tx);

      const contest = await tx.contest.findUnique({
        where: { id: contestId },
        select: {
          id: true,
          status: true,
          seriesId: true,
          lanes: { select: { id: true } },
          settlementSummary: { select: { id: true } },
        },
      });

      if (!contest) throw new RuleError("Contest not found.", 404);
      if (contest.status !== ContestStatus.LOCKED)
        throw new RuleError("Contest must be LOCKED before settlement.");
      if (contest.settlementSummary) throw new RuleError("Contest is already settled.");
      if (contest.lanes.length === 0) throw new RuleError("Contest must have lanes before settlement.");
      if (lanes.length !== contest.lanes.length)
        throw new RuleError("Settlement requires final rank for every lane.");
      if (!lanes.some((l) => l.finalRank === 1))
        throw new RuleError("At least one lane must be ranked 1st.");

      const validLaneIds = new Set(contest.lanes.map((lane) => lane.id));
      const seenLaneIds = new Set<string>();

      for (const lane of lanes) {
        if (!validLaneIds.has(lane.laneId)) throw new RuleError("Invalid lane provided in settlement.");
        if (seenLaneIds.has(lane.laneId)) throw new RuleError("Duplicate lane provided in settlement.");
        seenLaneIds.add(lane.laneId);

        if (
          !Number.isInteger(lane.finalRank) ||
          lane.finalRank < 1 ||
          lane.finalRank > contest.lanes.length
        ) {
          throw new RuleError(`Final ranks must be integers from 1 to ${contest.lanes.length}.`);
        }

        if (
          lane.fantasyPoints !== undefined &&
          lane.fantasyPoints !== null &&
          !Number.isFinite(lane.fantasyPoints)
        ) {
          throw new RuleError("Fantasy points must be numeric when provided.");
        }
      }

      // Enforce competition ranking (ties allowed, skipped ranks required after ties)
      // Valid examples: 1,2,2,4  |  1,2,3,3,5  |  1,1,3,4
      const sortedRanks = lanes
        .map((l) => l.finalRank)
        .sort((a, b) => a - b);

      if (sortedRanks[0] !== 1) {
        throw new RuleError("Ranks must start at 1.");
      }

      let i = 0;
      while (i < sortedRanks.length) {
        const currentRank = sortedRanks[i];

        let tieCount = 1;
        while (i + tieCount < sortedRanks.length && sortedRanks[i + tieCount] === currentRank) {
          tieCount += 1;
        }

        const nextIndex = i + tieCount;
        if (nextIndex < sortedRanks.length) {
          const expectedNextRank = currentRank + tieCount;
          const actualNextRank = sortedRanks[nextIndex];

          if (actualNextRank !== expectedNextRank) {
            throw new RuleError(
              `Invalid rank sequence. After ${tieCount} finisher(s) at rank ${currentRank}, expected next rank ${expectedNextRank}, got ${actualNextRank}.`
            );
          }
        }

        i = nextIndex;
      }

      // Persist ranks/points
      await Promise.all(
        lanes.map((lane) =>
          tx.lane.update({
            where: { id: lane.laneId },
            data: {
              finalRank: lane.finalRank,
              fantasyPoints: lane.fantasyPoints ?? null,
            },
          })
        )
      );

      // Pull BET transactions tied to TicketLegs
      const betTxs = await tx.transaction.findMany({
        where: {
          contestId,
          type: TransactionType.BET,
          ticketLegId: { not: null },
        },
        select: {
          userId: true,
          amount: true, // negative
          ticketId: true,
          ticketLegId: true,
          ticketLeg: {
            select: {
              id: true,
              laneId: true,
              market: true,
              isVoided: true,
            },
          },
        },
      });

      // Gross pool totals by market (exclude voided legs)
      const poolTotalsGross = zeroMarketMap();
      for (const btx of betTxs) {
        const leg = btx.ticketLeg;
        if (!leg) continue;
        if (leg.isVoided) continue;
        poolTotalsGross[leg.market] += Math.abs(btx.amount);
      }

      // ✅ Apply rake for settlement payouts (use NET pools)
      const poolTotals = zeroMarketMap(); // net pools used for payouts
      const takeoutTotals = zeroMarketMap(); // for debugging/optional display
      for (const market of MARKETS) {
        const { net, takeout } = applyRake(poolTotalsGross[market]);
        poolTotals[market] = net;
        takeoutTotals[market] = takeout;
      }

      // Dead-heat lane shares computed from NET pools
      const laneSharesByMarket = computeLaneSharesByMarket(
        lanes.map((l) => ({ laneId: l.laneId, finalRank: l.finalRank })),
        poolTotals
      );

      // Total wager per (market, lane) (exclude voided legs)
      const betTotalsByMarketLane: Record<Market, Map<string, number>> = {
        [Market.WIN]: new Map(),
        [Market.PLACE]: new Map(),
        [Market.SHOW]: new Map(),
      };

      for (const btx of betTxs) {
        const leg = btx.ticketLeg;
        if (!leg) continue;
        if (leg.isVoided) continue;

        const wager = Math.abs(btx.amount);
        betTotalsByMarketLane[leg.market].set(
          leg.laneId,
          (betTotalsByMarketLane[leg.market].get(leg.laneId) ?? 0) + wager
        );
      }

      // lane multiple = laneShare / total bet on that lane for that market
      const laneMultipleByMarket: Record<Market, Map<string, number>> = {
        [Market.WIN]: new Map(),
        [Market.PLACE]: new Map(),
        [Market.SHOW]: new Map(),
      };

      for (const market of MARKETS) {
        for (const [laneId, laneShare] of laneSharesByMarket[market].entries()) {
          const laneBetTotal = betTotalsByMarketLane[market].get(laneId) ?? 0;
          const raw = laneBetTotal > 0 ? laneShare / laneBetTotal : 0;
          laneMultipleByMarket[market].set(laneId, raw > 0 ? raw : 0);
        }
      }

      const now = new Date();

      // Safety net: ensure voided legs are marked VOID
      await tx.ticketLeg.updateMany({
        where: {
          contestId,
          isVoided: true,
          result: LegResult.PENDING,
        },
        data: {
          result: LegResult.VOID,
          settledAt: now,
        },
      });

      // Track leg win/lose for TicketLeg updates
      const winningLegIds: string[] = [];
      const losingLegIds: string[] = [];

      // Roll up payout by ticketId
      const payoutByTicketId = new Map<string, { userId: string; amount: number }>();

      for (const btx of betTxs) {
        const leg = btx.ticketLeg;
        if (!leg) continue;
        if (leg.isVoided) continue;

        if (!btx.ticketId) continue;
        if (!btx.ticketLegId) continue;

        const ticketId = btx.ticketId;
        const mult = laneMultipleByMarket[leg.market].get(leg.laneId) ?? 0;
        const wager = Math.abs(btx.amount);

        if (mult > 0) {
          const legPayoutAmount = Math.floor(wager * mult);
          if (legPayoutAmount > 0) {
            const cur = payoutByTicketId.get(ticketId);
            if (cur) cur.amount += legPayoutAmount;
            else payoutByTicketId.set(ticketId, { userId: btx.userId, amount: legPayoutAmount });

            winningLegIds.push(leg.id);
            continue;
          }
        }

        losingLegIds.push(leg.id);
      }

      const winningLegIdsUnique = Array.from(new Set(winningLegIds));
      const losingLegIdsUnique = Array.from(new Set(losingLegIds));

      // Create ONE PAYOUT tx per ticket
      const payoutTransactions: Array<{
        userId: string;
        type: TransactionType;
        amount: number;
        seriesId: string;
        contestId: string;
        ticketId: string;
        createdByAdminId: string;
        note: string;
      }> = [];

      for (const [ticketId, p] of payoutByTicketId.entries()) {
        if (p.amount <= 0) continue;

        payoutTransactions.push({
          userId: p.userId,
          type: TransactionType.PAYOUT,
          amount: p.amount,
          seriesId: contest.seriesId,
          contestId,
          ticketId,
          createdByAdminId: adminId,
          note: `Ticket payout`,
        });
      }

      const payoutInsertCount =
        payoutTransactions.length > 0
          ? (
              await tx.transaction.createMany({
                data: payoutTransactions,
                skipDuplicates: true,
              })
            ).count
          : 0;

      // Update TicketLeg results (never overwrite voided legs)
      if (winningLegIdsUnique.length > 0) {
        await tx.ticketLeg.updateMany({
          where: { id: { in: winningLegIdsUnique }, isVoided: false },
          data: { result: LegResult.WON, settledAt: now },
        });
      }

      if (losingLegIdsUnique.length > 0) {
        await tx.ticketLeg.updateMany({
          where: { id: { in: losingLegIdsUnique }, isVoided: false },
          data: { result: LegResult.LOST, settledAt: now },
        });
      }

      // Compute stake by ticket from BET txs (exclude voided legs)
      const ticketStakeById = new Map<string, number>();
      for (const btx of betTxs) {
        if (!btx.ticketId) continue;

        const leg = btx.ticketLeg;
        if (!leg) continue;
        if (leg.isVoided) continue;

        ticketStakeById.set(
          btx.ticketId,
          (ticketStakeById.get(btx.ticketId) ?? 0) + Math.abs(btx.amount)
        );
      }

      // Include ALL tickets that had BET activity in this contest (even if all legs were voided)
      const ticketIds = Array.from(
        new Set(betTxs.map((b) => b.ticketId).filter((id): id is string => Boolean(id)))
      );

      // Roll up payouts FROM DB
      const payoutRows = ticketIds.length
        ? await tx.transaction.findMany({
            where: {
              contestId,
              type: TransactionType.PAYOUT,
              ticketId: { in: ticketIds },
            },
            select: {
              ticketId: true,
              amount: true,
            },
          })
        : [];

      const ticketPayoutById = new Map<string, number>();
      for (const p of payoutRows) {
        if (!p.ticketId) continue;
        ticketPayoutById.set(p.ticketId, (ticketPayoutById.get(p.ticketId) ?? 0) + p.amount);
      }

      // Update Tickets (status/result/payout/net/settledAt)
      await Promise.all(
        ticketIds.map(async (ticketId) => {
          const payout = ticketPayoutById.get(ticketId) ?? 0;

          // ✅ IMPORTANT: do NOT use Ticket.stakeAmount here; it doesn't reflect void refunds
          const stake = ticketStakeById.get(ticketId) ?? 0;

          const net = payout - stake;

          let result: TicketResult = TicketResult.LOST;
          if (stake === 0 && payout === 0) result = TicketResult.PUSH; // scratched-only / refunded-only
          else if (payout <= 0) result = TicketResult.LOST;
          else if (payout < stake) result = TicketResult.PARTIAL;
          else if (payout === stake) result = TicketResult.PUSH;
          else result = TicketResult.WON;

          await tx.ticket.update({
            where: { id: ticketId },
            data: {
              status: TicketStatus.SETTLED,
              result,
              payoutAmount: payout,
              netAmount: net,
              settledAt: now,
            },
          });
        })
      );

      // Summary payout multiples for display
      const winnersTotal = zeroMarketMap();
      for (const market of MARKETS) {
        for (const [laneId, laneShare] of laneSharesByMarket[market].entries()) {
          if (laneShare <= 0) continue;
          winnersTotal[market] += betTotalsByMarketLane[market].get(laneId) ?? 0;
        }
      }

      const payoutMultiples: MarketNumberMap = {
        [Market.WIN]:
          winnersTotal[Market.WIN] > 0 ? poolTotals[Market.WIN] / winnersTotal[Market.WIN] : 0,
        [Market.PLACE]:
          winnersTotal[Market.PLACE] > 0 ? poolTotals[Market.PLACE] / winnersTotal[Market.PLACE] : 0,
        [Market.SHOW]:
          winnersTotal[Market.SHOW] > 0 ? poolTotals[Market.SHOW] / winnersTotal[Market.SHOW] : 0,
      };

      await tx.settlementSummary.create({
        data: {
          contestId,

          winPoolGross: poolTotalsGross[Market.WIN],
          placePoolGross: poolTotalsGross[Market.PLACE],
          showPoolGross: poolTotalsGross[Market.SHOW],

          winTakeoutTotal: takeoutTotals[Market.WIN],
          placeTakeoutTotal: takeoutTotals[Market.PLACE],
          showTakeoutTotal: takeoutTotals[Market.SHOW],

          winPoolTotal: poolTotals[Market.WIN],
          placePoolTotal: poolTotals[Market.PLACE],
          showPoolTotal: poolTotals[Market.SHOW],

          winPayoutMultiple: payoutMultiples[Market.WIN],
          placePayoutMultiple: payoutMultiples[Market.PLACE],
          showPayoutMultiple: payoutMultiples[Market.SHOW],
        },
      });

      await tx.contest.update({
        where: { id: contestId },
        data: { status: ContestStatus.SETTLED, settledAt: now },
      });

      // OFFICIAL system post: Settlement finalized (idempotent)
      const alreadyPosted = await tx.contestPost.findFirst({
        where: {
          contestId,
          isCommish: true,
          body: { startsWith: SETTLEMENT_FINALIZED_POST_PREFIX },
        },
        select: { id: true },
      });

      if (!alreadyPosted) {
        await tx.contestPost.create({
          data: {
            contestId,
            userId: adminId,
            isCommish: true,
            body: `${SETTLEMENT_FINALIZED_POST_PREFIX} Results are final. Leaderboard is now official. 🏁`,
          },
        });
      }

      return {
        contestId,
        poolTotalsGross,
        poolTotalsNet: poolTotals,
        takeoutTotals,
        payoutMultiples,
        payoutsAttempted: payoutTransactions.length,
        payoutsCreated: payoutInsertCount,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

type LeaderboardScope =
  | { scope: "global"; eligibleOnly?: boolean }
  | { scope: "series"; seriesId: string; eligibleOnly?: boolean };

export async function getLeaderboard(params: LeaderboardScope): Promise<LeaderboardEntry[]> {
  const eligibleOnly = params.eligibleOnly ?? false;

  // For series scope, collect contest IDs so BET tx can be scoped correctly
  let contestIdSet: Set<string> | null = null;

  if (params.scope === "series") {
    const contests = await prisma.contest.findMany({
      where: { seriesId: params.seriesId },
      select: { id: true },
    });
    contestIdSet = new Set(contests.map((c) => c.id));
  }

  const users = await prisma.user.findMany({
    where:
      params.scope === "series"
        ? {
            OR: [
              { transactions: { some: { seriesId: params.seriesId } } },
              { tickets: { some: { seriesId: params.seriesId } } },
            ],
          }
        : {
            OR: [{ transactions: { some: {} } }, { tickets: { some: {} } }],
          },
    select: {
      id: true,
      displayName: true,
      transactions: {
        select: {
          amount: true,
          type: true,
          seriesId: true,
          contestId: true,
        },
      },
      tickets:
        params.scope === "series"
          ? {
              where: { seriesId: params.seriesId },
              select: { contestId: true, status: true, result: true },
            }
          : {
              select: { contestId: true, status: true, result: true },
            },
    },
  });

  const rows: Omit<LeaderboardEntry, "rank">[] = [];

  for (const user of users) {
    // Balance = sum of all transactions in-scope
    const scopedTx = user.transactions.filter((tx) => {
      if (params.scope === "global") return true;

      // series scope
      if (tx.seriesId === params.seriesId) return true;

      // allow contest-scoped tx for contests in this series
      if (tx.contestId && contestIdSet && contestIdSet.has(tx.contestId)) return true;

      return false;
    });

    const balance = scopedTx.reduce((sum, tx) => sum + tx.amount, 0);

    const totalGranted = scopedTx
      .filter((tx) => tx.type === TransactionType.GRANT)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalWagered = scopedTx
      .filter((tx) => tx.type === TransactionType.BET)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    // participatedContests now comes from tickets (new system)
    const participatedContests = new Set((user.tickets ?? []).map((t) => t.contestId)).size;

    // Settled contests approximated from tickets with status SETTLED
    const settledContestIds = new Set(
      (user.tickets ?? [])
        .filter((t: any) => t.status === TicketStatus.SETTLED)
        .map((t) => t.contestId)
    );
    const settledContests = settledContestIds.size;

    // Settled-only contest-scoped transactions (for skill metrics)
    const settledTx = scopedTx.filter(
      (tx) => tx.contestId && settledContestIds.has(tx.contestId)
    );

    const settledBalance = settledTx.reduce((sum, tx) => sum + tx.amount, 0);
    const settledGranted = settledTx
      .filter((tx) => tx.type === TransactionType.GRANT)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const settledWagered = settledTx
      .filter((tx) => tx.type === TransactionType.BET)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const settledNet = settledBalance - settledGranted;

    // Per-contest net for this user (for Winning Contest % and consistency), from settledTx only
    const contestNet = new Map<string, number>();
    for (const tx of settledTx) {
      const cid = tx.contestId!;
      contestNet.set(cid, (contestNet.get(cid) ?? 0) + tx.amount);
    }

    // Podium finishes (v1): settled contests where user finished profitable (>0 net)
    let podiumFinishes = 0;
    let nonLosingContests = 0;
    for (const contestId of settledContestIds) {
      const netForContest = contestNet.get(contestId) ?? 0;
      if (netForContest > 0) {
        podiumFinishes += 1;
        nonLosingContests += 1;
      } else if (netForContest === 0) {
        nonLosingContests += 1;
      }
    }

    const net = balance - totalGranted;

    // Settled-only ROI for leaderboard skill metrics
    const roiRaw = settledWagered > 0 ? settledNet / settledWagered : 0;
    const clampedRoi = Math.max(-1, Math.min(1, roiRaw));
    const roiScore = ((clampedRoi + 1) / 2) * 100;

    const podiumRate = settledContests > 0 ? podiumFinishes / settledContests : 0;
    // Consistency fallback: rate of contests where the user did not lose money (>= 0 net)
    const consistencyRate = settledContests > 0 ? nonLosingContests / settledContests : 0;
    const consistencyScore = consistencyRate * 100;

    const credibilityScore =
      settledContests > 0 ? Math.min(settledContests / 20, 1) * 100 : 0;

    const topFinishScore = podiumRate * 100;

    const skillScore =
      0.4 * roiScore +
      0.25 * topFinishScore +
      0.2 * consistencyScore +
      0.15 * credibilityScore;

    const eligible =
      totalWagered >= LEADERBOARD_MIN_WAGER &&
      settledContests >= LEADERBOARD_MIN_SETTLED_CONTESTS;

    if (eligibleOnly && !eligible) continue;

    rows.push({
      userId: user.id,
      displayName: user.displayName,
      balance,
      totalGranted,
      net,
      totalWagered,
      participatedContests,
      settledContests,
      podiumFinishes,
      roi: roiRaw,
      podiumRate,
      consistencyRate,
      credibilityScore,
      skillScore,
      eligible,
    });
  }

  rows.sort((a, b) => {
    if (b.skillScore !== a.skillScore) return b.skillScore - a.skillScore;
    if (b.net !== a.net) return b.net - a.net;
    return a.displayName.localeCompare(b.displayName);
  });

  return rows.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

// Backward-compatible series leaderboard (same signature you already use)
export async function getSeriesLeaderboard(seriesId: string, eligibleOnly = false): Promise<LeaderboardEntry[]> {
  return getLeaderboard({ scope: "series", seriesId, eligibleOnly });
}

// New: global leaderboard
export async function getGlobalLeaderboard(eligibleOnly = false): Promise<LeaderboardEntry[]> {
  return getLeaderboard({ scope: "global", eligibleOnly });
}