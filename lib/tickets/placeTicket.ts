// lib/tickets/placeTicket.ts
import { prisma } from "@/lib/prisma";
import { ContestStatus, TicketStatus, Market } from "@prisma/client";
import {
  MIN_BET_AMOUNT,
  MAX_BET_AMOUNT,
  REQUIRED_TOTAL_WAGER_PER_CONTEST,
} from "@/lib/constants";
import { RuleError } from "@/lib/market";

type LegInput = {
  laneId: string;
  market: Market;
};

export async function placeTicket(opts: {
  userId: string;
  contestId: string;
  seriesId?: string | null;
  stakeAmount: number; // total cost (ex: WPS = amount*3)
  legs: LegInput[];
}) {
  const { userId, contestId, seriesId, stakeAmount, legs } = opts;

  if (!userId) throw new Error("Missing userId");
  if (!contestId) throw new Error("Missing contestId");
  if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
    throw new RuleError("Stake must be greater than 0.", 400);
  }
  if (!legs?.length) throw new Error("Ticket must have at least 1 leg");

  // Validate lanes belong to this contest + grab snapshots
  const laneIds = [...new Set(legs.map((l) => l.laneId))];
  const lanes = await prisma.lane.findMany({
    where: { id: { in: laneIds }, contestId },
    select: { id: true, name: true, team: true, position: true, openingWinOddsTo1: true },
  });

  const laneById = new Map(lanes.map((l) => [l.id, l]));
  for (const l of legs) {
    if (!laneById.has(l.laneId)) {
      throw new RuleError("One or more lanes are invalid for this contest.", 400);
    }
  }

  // Enforce integer total stake
  if (!Number.isInteger(stakeAmount)) {
    throw new RuleError("Stake must be a whole number.", 400);
  }

  // Enforce increments of 5
  if (stakeAmount % 5 !== 0) {
    throw new RuleError("Stake must be in increments of 5.", 409);
  }

  // Keep exact split across legs to prevent rounding drift
  if (stakeAmount % legs.length !== 0) {
    throw new RuleError("Stake must be evenly divisible across legs.", 400);
  }

  const perLegAmount = stakeAmount / legs.length;

  // Per-leg validation
  if (!Number.isInteger(perLegAmount)) {
    throw new RuleError("Each leg amount must be a whole number.", 400);
  }

  if (perLegAmount % 5 !== 0) {
    throw new RuleError("Each leg amount must be in increments of 5.", 409);
  }

  if (perLegAmount < MIN_BET_AMOUNT) {
    throw new RuleError(`Minimum wager per leg is ${MIN_BET_AMOUNT}.`, 409);
  }

  if (perLegAmount > MAX_BET_AMOUNT) {
    throw new RuleError(`Maximum wager per leg is ${MAX_BET_AMOUNT}.`, 409);
  }

  const ticket = await prisma.$transaction(async (tx) => {
    // 1) DB-enforced contest status check
    const contest = await tx.contest.findUnique({
      where: { id: contestId },
      select: { id: true, status: true, seriesId: true },
    });

    if (!contest) throw new RuleError("Contest not found.", 404);

    if (contest.status === ContestStatus.LOCKED) {
      throw new RuleError("Contest is locked. Betting is closed.", 409);
    }
    if (contest.status === ContestStatus.SETTLED) {
      throw new RuleError("Contest is settled. Betting is closed.", 409);
    }
    if (contest.status !== ContestStatus.PUBLISHED) {
      throw new RuleError("Contest is not open for betting.", 409);
    }

    // 2) DB-enforced contest allocation cap
    // Count only ACTIVE, NON-VOIDED legs so scratched/refunded legs
    // no longer consume contest allocation.
    const agg = await tx.ticketLeg.aggregate({
      where: {
        userId,
        contestId,
        isVoided: false,
        ticket: {
          status: TicketStatus.SUBMITTED,
        },
      },
      _sum: { amount: true },
    });

    const alreadyCommitted = agg._sum.amount ?? 0;
    const newTotal = alreadyCommitted + stakeAmount;

    if (newTotal > REQUIRED_TOTAL_WAGER_PER_CONTEST) {
      const remaining = Math.max(0, REQUIRED_TOTAL_WAGER_PER_CONTEST - alreadyCommitted);
      throw new RuleError(
        `This wager exceeds your remaining contest allocation. Remaining: ${remaining}.`,
        409
      );
    }

    // 3) Create ticket + legs
    const created = await tx.ticket.create({
      data: {
        userId,
        contestId,
        seriesId: seriesId ?? contest.seriesId ?? null,
        status: TicketStatus.SUBMITTED,
        stakeAmount,
        placedAt: new Date(),
        legs: {
          create: legs.map((leg) => {
            const lane = laneById.get(leg.laneId)!;
            return {
              userId,
              contestId,
              laneId: leg.laneId,
              market: leg.market,
              amount: perLegAmount,
              laneNameSnap: lane.name,
              teamSnap: lane.team,
              positionSnap: lane.position,
              oddsTo1Snap: leg.market === Market.WIN ? (lane.openingWinOddsTo1 ?? null) : null,
            };
          }),
        },
      },
      include: { legs: true },
    });

    // 4) Create one BET transaction per leg
    await tx.transaction.createMany({
      data: created.legs.map((leg) => ({
        userId,
        type: "BET",
        amount: -perLegAmount,
        seriesId: seriesId ?? contest.seriesId ?? null,
        contestId,
        ticketId: created.id,
        ticketLegId: leg.id,
        note: `Leg bet (${leg.market})`,
      })),
    });

    return created;
  });

  return ticket;
}