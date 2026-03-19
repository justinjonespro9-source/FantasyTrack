import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { runBasketballLiveStatsPull } from "@/lib/basketball-live-stats";
import { ContestStatus } from "@prisma/client";

/**
 * POST /api/internal/basketball-live-stats/bulk
 *
 * Pull live stats for all relevant basketball contests (PUBLISHED or LOCKED, with externalProvider/externalId).
 * Returns summary: updated, skipped, failed.
 * Auth: admin only.
 */
export async function POST() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contests = await prisma.contest.findMany({
    where: {
      sport: "BASKETBALL",
      status: { in: [ContestStatus.PUBLISHED, ContestStatus.LOCKED] },
      externalProvider: { not: null },
      externalId: { not: null },
      archivedAt: null,
    },
    select: { id: true, title: true },
    orderBy: { startTime: "asc" },
  });

  let totalUpdated = 0;
  let totalSkipped = 0;
  const contestResults: { contestId: string; title: string; updated: number; skipped: number }[] = [];
  const failedContests: { contestId: string; title: string; error: string }[] = [];

  for (const contest of contests) {
    try {
      const result = await runBasketballLiveStatsPull(contest.id);
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      contestResults.push({
        contestId: contest.id,
        title: contest.title,
        updated: result.updated,
        skipped: result.skipped,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      failedContests.push({ contestId: contest.id, title: contest.title, error });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");
  for (const r of contestResults) {
    revalidatePath(`/contest/${r.contestId}`);
  }

  return NextResponse.json({
    updated: totalUpdated,
    skipped: totalSkipped,
    failed: failedContests.length,
    contestCount: contestResults.length,
    contestResults,
    failedContests,
    completedAt: new Date().toISOString(),
  });
}
