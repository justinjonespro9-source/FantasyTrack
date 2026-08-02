import type { Prisma, PrismaClient } from "@prisma/client";

type DbLike = PrismaClient | Prisma.TransactionClient;

/** Clear obsolete closing-market snapshots so a later lock captures fresh odds. */
export async function clearClosingOddsForContest(
  contestId: string,
  db: DbLike
): Promise<number> {
  const result = await db.lane.updateMany({
    where: { contestId },
    data: {
      closingWinOddsTo1: null,
      closingPlaceOddsTo1: null,
      closingShowOddsTo1: null,
    },
  });
  return result.count;
}
