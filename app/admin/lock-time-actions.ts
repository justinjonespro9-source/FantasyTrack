"use server";

import { ContestStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  applyLockTimeUpdate,
  loadContestLockSnapshot,
  planLockTimeUpdate,
  warningCopy,
  type LockTimeReopenMode,
  type LockTimeUpdateResult,
} from "@/lib/admin/update-contest-lock-time";
import {
  formatLockTimeCt,
  parseCentralDateTime,
} from "@/lib/contest/central-time";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session?.user?.id || !session.user.isAdmin) {
    throw new Error("Admin access required.");
  }
  return session;
}

function parseMode(raw: FormDataEntryValue | null): LockTimeReopenMode {
  const v = String(raw ?? "auto");
  if (v === "update_and_reopen" || v === "time_only" || v === "auto") return v;
  return "auto";
}

function parseCentralFromForm(formData: FormData): Date {
  const date = String(formData.get("lockDate") ?? "").trim();
  const time = String(formData.get("lockTime") ?? "").trim();
  if (!date) throw new Error("Lock date is required.");
  if (!time) throw new Error("Lock time is required.");
  return parseCentralDateTime(date, time);
}

function revalidateContestPaths(contestIds: string[]) {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/races");
  for (const id of contestIds) {
    revalidatePath(`/contest/${id}`);
  }
}

const lockSelect = {
  id: true,
  title: true,
  status: true,
  startTime: true,
  lockedAt: true,
  lockSource: true,
  settledAt: true,
  _count: { select: { tickets: true } },
  lanes: {
    select: {
      closingWinOddsTo1: true,
      closingPlaceOddsTo1: true,
      closingShowOddsTo1: true,
    },
  },
} as const;

export type LockTimePreviewRow = {
  id: string;
  title: string;
  status: ContestStatus;
  currentLockLabel: string;
  newLockLabel: string;
  willReopen: boolean;
  willClearClosingSnapshots: boolean;
  requiresManualConfirmation: boolean;
  blockedReason: string | null;
  warnings: string[];
};

export async function previewContestLockTimeAction(input: {
  contestIds: string[];
  lockDate: string;
  lockTime: string;
  reopenMode?: LockTimeReopenMode;
}): Promise<{ newLockLabel: string; rows: LockTimePreviewRow[] }> {
  await requireAdminSession();
  const newStartTime = parseCentralDateTime(input.lockDate, input.lockTime);
  const mode = input.reopenMode ?? "auto";
  const now = new Date();

  const contests = await prisma.contest.findMany({
    where: { id: { in: input.contestIds } },
    select: lockSelect,
  });

  const byId = new Map(contests.map((c) => [c.id, c]));
  const rows: LockTimePreviewRow[] = [];

  for (const id of input.contestIds) {
    const row = byId.get(id);
    if (!row) continue;
    const snapshot = loadContestLockSnapshot(row);
    const plan = planLockTimeUpdate(snapshot, newStartTime, mode, now);
    rows.push({
      id: snapshot.id,
      title: snapshot.title,
      status: snapshot.status,
      currentLockLabel: formatLockTimeCt(snapshot.startTime),
      newLockLabel: formatLockTimeCt(newStartTime),
      willReopen: plan.willReopen,
      willClearClosingSnapshots: plan.willClearClosingSnapshots,
      requiresManualConfirmation: plan.requiresManualConfirmation,
      blockedReason: plan.blockedReason,
      warnings: plan.warnings.map((w) => warningCopy(w, snapshot)),
    });
  }

  return { newLockLabel: formatLockTimeCt(newStartTime), rows };
}

export async function updateContestLockTimeFormAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const contestId = String(formData.get("contestId") ?? "").trim();
  if (!contestId) throw new Error("Missing contestId");

  const mode = parseMode(formData.get("reopenMode"));
  const newStartTime = parseCentralFromForm(formData);

  const row = await prisma.contest.findUnique({
    where: { id: contestId },
    select: lockSelect,
  });
  if (!row) throw new Error("Contest not found.");

  const plan = planLockTimeUpdate(loadContestLockSnapshot(row), newStartTime, mode);
  const result = await prisma.$transaction(async (tx) =>
    applyLockTimeUpdate(tx, plan, { adminUserId: session.user.id })
  );

  revalidateContestPaths([contestId]);
  redirect(`/admin?lockMsg=${encodeURIComponent(result.message)}`);
}

export async function bulkUpdateContestLockTimeAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const idsRaw = String(formData.get("contestIds") ?? "");
  const contestIds = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (contestIds.length === 0) throw new Error("Select at least one contest.");

  const mode = parseMode(formData.get("reopenMode"));
  const newStartTime = parseCentralFromForm(formData);
  const now = new Date();
  const results: LockTimeUpdateResult[] = [];

  await prisma.$transaction(async (tx) => {
    for (const contestId of contestIds) {
      const row = await tx.contest.findUnique({
        where: { id: contestId },
        select: lockSelect,
      });
      if (!row) throw new Error(`Contest not found: ${contestId}`);

      const snap = loadContestLockSnapshot(row);
      const plan = planLockTimeUpdate(snap, newStartTime, mode, now);
      if (plan.blockedReason) {
        throw new Error(`${snap.title}: ${plan.blockedReason}`);
      }
      if (plan.requiresManualConfirmation) {
        throw new Error(
          `${snap.title} was manually locked. Use Update and Reopen or Update Time Only in the preview flow.`
        );
      }

      results.push(
        await applyLockTimeUpdate(tx, plan, {
          adminUserId: session.user.id,
          now,
        })
      );
    }
  });

  revalidateContestPaths(contestIds);

  const reopened = results.filter((r) => r.reopened).length;
  const msg = `Updated lock time on ${results.length} race(s) to ${formatLockTimeCt(newStartTime)}.${
    reopened ? ` Reopened ${reopened}.` : ""
  }`;
  redirect(`/admin?lockMsg=${encodeURIComponent(msg)}`);
}

export async function applySeriesPositionLockTimeAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  if (!seriesId) throw new Error("Missing seriesId");

  const contests = await prisma.contest.findMany({
    where: {
      seriesId,
      archivedAt: null,
      contestType: "POSITION_WEEKLY",
      status: { in: [ContestStatus.PUBLISHED, ContestStatus.LOCKED, ContestStatus.DRAFT] },
    },
    select: { id: true },
  });

  if (contests.length === 0) {
    throw new Error("No open position races found in this series.");
  }

  const next = new FormData();
  next.set("contestIds", contests.map((c) => c.id).join(","));
  next.set("lockDate", String(formData.get("lockDate") ?? ""));
  next.set("lockTime", String(formData.get("lockTime") ?? ""));
  next.set("reopenMode", String(formData.get("reopenMode") ?? "auto"));
  await bulkUpdateContestLockTimeAction(next);
}
