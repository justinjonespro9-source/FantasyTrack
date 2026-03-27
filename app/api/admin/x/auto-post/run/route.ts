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

async function runLockReminders(now: Date, failures: FailureItem[]): Promise<number> {
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
      series: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  let posted = 0;
  for (const contest of contests) {
    const postedText = buildLockReminderPost(contest);
    const reserved = await reservePostLog(contest.id, XPostType.LOCK_REMINDER, postedText);
    if (!reserved) continue;

    try {
      const result = await publishPostToConnectedX(postedText);
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

async function runSettlementRecaps(now: Date, failures: FailureItem[]): Promise<number> {
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
      series: { select: { name: true } },
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
      const result = await publishPostToConnectedX(postedText);
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
  const now = new Date();

  const remindersPosted = await runLockReminders(now, failures);
  const recapsPosted = await runSettlementRecaps(now, failures);

  return NextResponse.json({
    ok: true,
    remindersPosted,
    recapsPosted,
    failures,
  });
}
