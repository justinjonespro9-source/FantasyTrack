import { NextRequest, NextResponse } from "next/server";
import { XPostStatus, XPostType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildLockReminderPost, buildSettlementRecapPost } from "@/lib/x/auto-post-text";
import { publishPostToConnectedX, XPostError } from "@/lib/x/post";

const LOCK_REMINDER_MINUTES = 45;
const SETTLEMENT_RECAP_DELAY_MINUTES = 5;

function hasValidAutomationSecret(req: NextRequest): boolean {
  const expected = process.env.X_AUTOMATION_SECRET?.trim();
  if (!expected) return false;

  const headerSecret = req.headers.get("x-automation-secret")?.trim();
  if (headerSecret && headerSecret === expected) return true;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return Boolean(bearer && bearer === expected);
}

type FailureItem = {
  contestId: string;
  postType: XPostType;
  error: string;
};

async function reservePostLog(contestId: string, postType: XPostType, postedText: string) {
  try {
    return await prisma.xPostLog.create({
      data: {
        contestId,
        postType,
        status: XPostStatus.FAILED,
        errorMessage: "Reserved for post attempt.",
        postedText,
      },
    });
  } catch {
    return null;
  }
}

async function runLockReminders(
  now: Date,
  failures: FailureItem[],
  skippedPrivate: { count: number }
): Promise<number> {
  const in45 = new Date(now.getTime() + LOCK_REMINDER_MINUTES * 60_000);
  const contests = await prisma.contest.findMany({
    where: {
      status: "PUBLISHED",
      startTime: {
        gte: now,
        lte: in45,
      },
      xPostLogs: {
        none: { postType: XPostType.LOCK_REMINDER },
      },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      series: { select: { name: true, isPrivate: true } },
    },
    orderBy: { startTime: "asc" },
  });

  let posted = 0;
  for (const contest of contests) {
    if (contest.series?.isPrivate) {
      console.log("[X POST SEND] skipped private contest", {
        contestId: contest.id,
        postType: "LOCK_REMINDER",
      });
      skippedPrivate.count += 1;
      continue;
    }

    const postedText = buildLockReminderPost(contest);
    const reserved = await reservePostLog(contest.id, XPostType.LOCK_REMINDER, postedText);
    if (!reserved) continue;

    try {
      const result = await publishPostToConnectedX(postedText, { contestId: contest.id });
      if (!result.success) {
        await prisma.xPostLog.update({
          where: { id: reserved.id },
          data: {
            status: XPostStatus.FAILED,
            errorMessage: "private_contest",
          },
        });
        failures.push({
          contestId: contest.id,
          postType: XPostType.LOCK_REMINDER,
          error: "private_contest",
        });
        continue;
      }
      await prisma.xPostLog.update({
        where: { id: reserved.id },
        data: {
          status: XPostStatus.POSTED,
          postId: result.postId,
          errorMessage: null,
          postedAt: new Date(),
        },
      });
      posted += 1;
    } catch (err) {
      const message = err instanceof XPostError ? err.message : "Failed to post lock reminder.";
      await prisma.xPostLog.update({
        where: { id: reserved.id },
        data: {
          status: XPostStatus.FAILED,
          errorMessage: message,
        },
      });
      failures.push({ contestId: contest.id, postType: XPostType.LOCK_REMINDER, error: message });
    }
  }

  return posted;
}

async function runSettlementRecaps(
  now: Date,
  failures: FailureItem[],
  skippedPrivate: { count: number }
): Promise<number> {
  const threshold = new Date(now.getTime() - SETTLEMENT_RECAP_DELAY_MINUTES * 60_000);
  const contests = await prisma.contest.findMany({
    where: {
      status: "SETTLED",
      settledAt: {
        not: null,
        lte: threshold,
      },
      xPostLogs: {
        none: { postType: XPostType.SETTLEMENT_RECAP },
      },
    },
    select: {
      id: true,
      title: true,
      series: { select: { name: true, isPrivate: true } },
      lanes: {
        where: { finalRank: { not: null, lte: 3 } },
        select: { name: true, finalRank: true, fantasyPoints: true },
        orderBy: [{ finalRank: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { settledAt: "asc" },
  });

  let posted = 0;
  for (const contest of contests) {
    if (contest.series?.isPrivate) {
      console.log("[X POST SEND] skipped private contest", {
        contestId: contest.id,
        postType: "SETTLEMENT_RECAP",
      });
      skippedPrivate.count += 1;
      continue;
    }

    const podium = contest.lanes
      .filter((l) => l.finalRank != null)
      .slice(0, 3)
      .map((l) => ({
        rank: l.finalRank as number,
        name: l.name,
        fantasyPoints: l.fantasyPoints ?? null,
      }));

    const postedText = buildSettlementRecapPost(contest, podium);
    const reserved = await reservePostLog(contest.id, XPostType.SETTLEMENT_RECAP, postedText);
    if (!reserved) continue;

    try {
      const result = await publishPostToConnectedX(postedText, { contestId: contest.id });
      if (!result.success) {
        await prisma.xPostLog.update({
          where: { id: reserved.id },
          data: {
            status: XPostStatus.FAILED,
            errorMessage: "private_contest",
          },
        });
        failures.push({
          contestId: contest.id,
          postType: XPostType.SETTLEMENT_RECAP,
          error: "private_contest",
        });
        continue;
      }
      await prisma.xPostLog.update({
        where: { id: reserved.id },
        data: {
          status: XPostStatus.POSTED,
          postId: result.postId,
          errorMessage: null,
          postedAt: new Date(),
        },
      });
      posted += 1;
    } catch (err) {
      const message = err instanceof XPostError ? err.message : "Failed to post settlement recap.";
      await prisma.xPostLog.update({
        where: { id: reserved.id },
        data: {
          status: XPostStatus.FAILED,
          errorMessage: message,
        },
      });
      failures.push({ contestId: contest.id, postType: XPostType.SETTLEMENT_RECAP, error: message });
    }
  }

  return posted;
}

export async function POST(req: NextRequest) {
  if (!hasValidAutomationSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const failures: FailureItem[] = [];
  const skippedPrivateContests = { count: 0 };
  const now = new Date();

  const remindersPosted = await runLockReminders(now, failures, skippedPrivateContests);
  const recapsPosted = await runSettlementRecaps(now, failures, skippedPrivateContests);

  return NextResponse.json({
    ok: true,
    remindersPosted,
    recapsPosted,
    skippedPrivateContests: skippedPrivateContests.count,
    failures,
  });
}
