import { ContestStatus, Market } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getContestOddsData, RuleError } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { placeTicket } from "@/lib/tickets/placeTicket";
import {
  REQUIRED_TOTAL_WAGER_PER_CONTEST,
  MAX_BET_AMOUNT,
  MIN_BET_AMOUNT,
} from "@/lib/constants";

// --------------------
// Schemas
// --------------------
const MAX_WPS_BET_AMOUNT = 30;

const isMultipleOf5 = (n: number) => n % 5 === 0;

const singleBetSchema = z.object({
  laneId: z.string().min(1),
  market: z.nativeEnum(Market),
  amount: z
    .number()
    .int()
    .min(MIN_BET_AMOUNT)
    .max(MAX_BET_AMOUNT)
    .refine(isMultipleOf5, { message: "Amount must be in increments of 5." }),
});

const wpsSchema = z.object({
  laneId: z.string().min(1),
  action: z.literal("WPS"),
  amount: z
    .number()
    .int()
    .min(MIN_BET_AMOUNT)
    .max(MAX_WPS_BET_AMOUNT)
    .refine(isMultipleOf5, { message: "Amount must be in increments of 5." }),
});

const payloadSchema = z.union([singleBetSchema, wpsSchema]);

type RouteContext = {
  params: { id: string };
};

// --------------------
// Helpers
// --------------------
function assertBettableContestStatus(status: ContestStatus) {
  if (status === ContestStatus.LOCKED) {
    throw new RuleError("Contest is locked. Betting is closed.", 409);
  }
  if (status === ContestStatus.SETTLED) {
    throw new RuleError("Contest is settled. Betting is closed.", 409);
  }
  if (status !== ContestStatus.PUBLISHED) {
    throw new RuleError("Contest is not open for betting.", 409);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = payloadSchema.parse(await req.json());
    const contestId = context.params.id;

    // Ensure contest exists + seriesId for ticket attribution
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { id: true, seriesId: true, status: true },
    });

    if (!contest) {
      throw new RuleError("Contest not found.", 404);
    }

    // Enforce contest status server-side
    assertBettableContestStatus(contest.status);

    const isWps = "action" in payload;

    // Legs: single market vs WPS (WIN+PLACE+SHOW)
    const legs = isWps
      ? [
          { laneId: payload.laneId, market: Market.WIN },
          { laneId: payload.laneId, market: Market.PLACE },
          { laneId: payload.laneId, market: Market.SHOW },
        ]
      : [{ laneId: payload.laneId, market: payload.market }];

    // Stake charged: single = amount, WPS = 3x
    const stakeAmount = isWps ? payload.amount * 3 : payload.amount;

    // Pull odds snapshot for lock window + remaining contest allocation
    const oddsBefore = await getContestOddsData(contestId, session.user.id);
    if (!oddsBefore) {
      throw new RuleError("Contest odds unavailable.", 500);
    }

    // Enforce lock window server-side
    if (oddsBefore.timeToLockSeconds <= 0) {
      throw new RuleError("Contest is locked. Betting is closed.", 409);
    }

    const requiredTotalPerContest = REQUIRED_TOTAL_WAGER_PER_CONTEST;

    // If the user has already fully allocated this contest, block additional wagers
    if (oddsBefore.myCoinsRemainingInContest <= 0) {
      throw new RuleError(
        `You have already allocated the full ${requiredTotalPerContest} points for this contest.`,
        409
      );
    }

    // Prevent this wager from exceeding the remaining contest allocation
    if (stakeAmount > oddsBefore.myCoinsRemainingInContest) {
      throw new RuleError(
        `This wager exceeds your remaining contest allocation. You have ${oddsBefore.myCoinsRemainingInContest} points left to use.`,
        409
      );
    }

    // Optional: ensure the lane exists
    const laneExists = await prisma.lane.findFirst({
      where: { id: payload.laneId, contestId },
      select: { id: true },
    });
    if (!laneExists) {
      throw new RuleError("Invalid lane for this contest.", 400);
    }

    // Place ticket
    const ticket = await placeTicket({
      userId: session.user.id,
      contestId,
      seriesId: contest.seriesId ?? null,
      stakeAmount,
      legs,
    });

    const refreshedOdds = await getContestOddsData(contestId, session.user.id);

    // Map ticket legs into legacy "createdBets" shape the UI expects
    const createdBets = ticket.legs.map((leg) => ({
      id: leg.id,
      ticketId: ticket.id,
      laneId: leg.laneId,
      market: leg.market,
      amount: payload.amount,
      createdAt: (leg as any).createdAt
        ? new Date((leg as any).createdAt).toISOString()
        : new Date().toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      createdBets,
      odds: refreshedOdds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    if (error instanceof RuleError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Unable to place bet." }, { status: 500 });
  }
}