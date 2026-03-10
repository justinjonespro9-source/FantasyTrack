// src/lib/entry.ts
import { prisma } from "@/lib/prisma";

export async function getContestStakeTotalForUser(contestId: string, userId: string) {
  const agg = await prisma.ticket.aggregate({
    where: {
      contestId,
      userId,
      // optional safety: ignore refunded/void if you ever add those fields
    },
    _sum: { stakeAmount: true },
  });

  return agg._sum.stakeAmount ?? 0;
}

export async function hasEnteredContest(contestId: string, userId: string) {
  // ✅ New rule: entered = placed at least 1 bet (any positive stake)
  const total = await getContestStakeTotalForUser(contestId, userId);
  return total > 0;
}