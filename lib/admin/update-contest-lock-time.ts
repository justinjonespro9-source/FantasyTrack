import { ContestStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { clearClosingOddsForContest } from "@/lib/admin/clear-closing-odds";
import { formatLockTimeCt } from "@/lib/contest/central-time";

type DbLike = Prisma.TransactionClient | PrismaClient;

export type LockSource = "AUTO" | "MANUAL";

export type LockTimeReopenMode = "auto" | "update_and_reopen" | "time_only";

export type LockTimeWarning =
  | "PAST_LOCK_TIME"
  | "HAS_ENTRIES"
  | "HAS_CLOSING_SNAPSHOTS"
  | "LOCK_WITHIN_15_MIN"
  | "MANUAL_LOCK_CONFIRMATION"
  | "SETTLED_BLOCKED";

export type ContestLockTimeSnapshot = {
  id: string;
  title: string;
  status: ContestStatus;
  startTime: Date;
  lockedAt: Date | null;
  lockSource: string | null;
  settledAt: Date | null;
  ticketCount: number;
  hasClosingSnapshots: boolean;
};

export type LockTimeUpdatePlan = {
  contest: ContestLockTimeSnapshot;
  newStartTime: Date;
  willReopen: boolean;
  willClearClosingSnapshots: boolean;
  requiresManualConfirmation: boolean;
  blockedReason: string | null;
  warnings: LockTimeWarning[];
  messagePreview: string;
};

export type LockTimeUpdateResult = {
  contestId: string;
  title: string;
  previousStartTime: Date;
  newStartTime: Date;
  previousStatus: ContestStatus;
  newStatus: ContestStatus;
  reopened: boolean;
  clearedClosingSnapshots: boolean;
  message: string;
};

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function isManualLock(lockSource: string | null | undefined): boolean {
  return (lockSource ?? "").toUpperCase() === "MANUAL";
}

export function loadContestLockSnapshot(
  row: {
    id: string;
    title: string;
    status: ContestStatus;
    startTime: Date;
    lockedAt: Date | null;
    lockSource?: string | null;
    settledAt: Date | null;
    _count?: { tickets: number };
    lanes?: Array<{
      closingWinOddsTo1: number | null;
      closingPlaceOddsTo1: number | null;
      closingShowOddsTo1: number | null;
    }>;
  }
): ContestLockTimeSnapshot {
  const lanes = row.lanes ?? [];
  const hasClosingSnapshots = lanes.some(
    (l) =>
      l.closingWinOddsTo1 != null ||
      l.closingPlaceOddsTo1 != null ||
      l.closingShowOddsTo1 != null
  );
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    startTime: row.startTime,
    lockedAt: row.lockedAt,
    lockSource: row.lockSource ?? null,
    settledAt: row.settledAt,
    ticketCount: row._count?.tickets ?? 0,
    hasClosingSnapshots,
  };
}

export function planLockTimeUpdate(
  contest: ContestLockTimeSnapshot,
  newStartTime: Date,
  mode: LockTimeReopenMode,
  now = new Date()
): LockTimeUpdatePlan {
  const warnings: LockTimeWarning[] = [];
  const newIsFuture = newStartTime.getTime() > now.getTime();
  const newIsPast = !newIsFuture;

  if (newIsPast) warnings.push("PAST_LOCK_TIME");
  if (contest.ticketCount > 0) warnings.push("HAS_ENTRIES");
  if (contest.hasClosingSnapshots) warnings.push("HAS_CLOSING_SNAPSHOTS");
  if (newIsFuture && newStartTime.getTime() - now.getTime() < FIFTEEN_MIN_MS) {
    warnings.push("LOCK_WITHIN_15_MIN");
  }

  if (contest.status === ContestStatus.SETTLED) {
    return {
      contest,
      newStartTime,
      willReopen: false,
      willClearClosingSnapshots: false,
      requiresManualConfirmation: false,
      blockedReason:
        "Settled contests cannot be reopened through the lock-time editor. Use the protected settlement reopen workflow first.",
      warnings: [...warnings, "SETTLED_BLOCKED"],
      messagePreview: "Blocked: contest is settled.",
    };
  }

  const locked = contest.status === ContestStatus.LOCKED;
  const manual = locked && isManualLock(contest.lockSource);
  const requiresManualConfirmation = manual && newIsFuture && mode === "auto";

  if (requiresManualConfirmation) {
    warnings.push("MANUAL_LOCK_CONFIRMATION");
    return {
      contest,
      newStartTime,
      willReopen: false,
      willClearClosingSnapshots: false,
      requiresManualConfirmation: true,
      blockedReason: null,
      warnings,
      messagePreview:
        "This race was manually locked. Choose Update and Reopen, Update Time Only, or Cancel.",
    };
  }

  let willReopen = false;
  if (locked && newIsFuture) {
    if (manual) {
      willReopen = mode === "update_and_reopen";
    } else {
      // AUTO or legacy null: safe to reopen when correcting a bad past lock time
      willReopen = mode !== "time_only";
    }
  }

  const willClearClosingSnapshots = willReopen && contest.hasClosingSnapshots;

  const messagePreview = willReopen
    ? `Lock time updated to ${formatLockTimeCt(newStartTime)}. The race has been reopened.`
    : `Lock time updated to ${formatLockTimeCt(newStartTime)}.`;

  return {
    contest,
    newStartTime,
    willReopen,
    willClearClosingSnapshots,
    requiresManualConfirmation: false,
    blockedReason: null,
    warnings,
    messagePreview,
  };
}

export function warningCopy(warning: LockTimeWarning, contest: ContestLockTimeSnapshot): string {
  switch (warning) {
    case "PAST_LOCK_TIME":
      return "The new lock time is in the past. A published race may auto-lock on the next request.";
    case "HAS_ENTRIES":
      return `This race has ${contest.ticketCount} existing entries. They will remain active after the lock time changes.`;
    case "HAS_CLOSING_SNAPSHOTS":
      return "This race has prior closing odds snapshots. They will be cleared if the race reopens.";
    case "LOCK_WITHIN_15_MIN":
      return "The new lock time is less than 15 minutes away.";
    case "MANUAL_LOCK_CONFIRMATION":
      return "This race was manually locked. Update the time and reopen it?";
    case "SETTLED_BLOCKED":
      return "Settled contests are protected from routine lock-time reopen.";
    default:
      return warning;
  }
}

export async function applyLockTimeUpdate(
  db: DbLike,
  plan: LockTimeUpdatePlan,
  opts: { adminUserId?: string | null; now?: Date } = {}
): Promise<LockTimeUpdateResult> {
  if (plan.blockedReason) {
    throw new Error(plan.blockedReason);
  }
  if (plan.requiresManualConfirmation) {
    throw new Error(
      "This race was manually locked. Confirm Update and Reopen or Update Time Only."
    );
  }

  const now = opts.now ?? new Date();
  const contest = plan.contest;
  let clearedClosingSnapshots = false;

  if (plan.willClearClosingSnapshots || (plan.willReopen && contest.hasClosingSnapshots)) {
    await clearClosingOddsForContest(contest.id, db);
    clearedClosingSnapshots = true;
  } else if (plan.willReopen) {
    // Always clear on reopen so stale null-checks stay consistent even if snapshot flag was stale
    const cleared = await clearClosingOddsForContest(contest.id, db);
    clearedClosingSnapshots = cleared > 0 || contest.hasClosingSnapshots;
  }

  const newStatus = plan.willReopen ? ContestStatus.PUBLISHED : contest.status;

  await db.contest.update({
    where: { id: contest.id },
    data: {
      startTime: plan.newStartTime,
      ...(plan.willReopen
        ? {
            status: ContestStatus.PUBLISHED,
            lockedAt: null,
            lockSource: null,
          }
        : {}),
    },
  });

  const message = plan.willReopen
    ? `Lock time updated to ${formatLockTimeCt(plan.newStartTime)}. The race has been reopened.`
    : `Lock time updated to ${formatLockTimeCt(plan.newStartTime)}.`;

  console.info("[admin:lock-time]", {
    contestId: contest.id,
    title: contest.title,
    adminUserId: opts.adminUserId ?? null,
    at: now.toISOString(),
    previousStartTime: contest.startTime.toISOString(),
    newStartTime: plan.newStartTime.toISOString(),
    previousStatus: contest.status,
    newStatus,
    reopened: plan.willReopen,
    clearedClosingSnapshots,
    lockSource: contest.lockSource,
  });

  return {
    contestId: contest.id,
    title: contest.title,
    previousStartTime: contest.startTime,
    newStartTime: plan.newStartTime,
    previousStatus: contest.status,
    newStatus,
    reopened: plan.willReopen,
    clearedClosingSnapshots,
    message,
  };
}
