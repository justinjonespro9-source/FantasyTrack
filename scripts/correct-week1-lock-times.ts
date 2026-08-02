/**
 * Correct Week 1 NFL position race lock times to Sep 13, 2026 10:00 AM America/Chicago.
 *
 * Usage:
 *   npx tsx scripts/correct-week1-lock-times.ts
 *   npx tsx scripts/correct-week1-lock-times.ts --apply
 */
import { ContestStatus } from "@prisma/client";
import {
  applyLockTimeUpdate,
  loadContestLockSnapshot,
  planLockTimeUpdate,
} from "../lib/admin/update-contest-lock-time";
import { formatLockTimeCt, parseCentralDateTime } from "../lib/contest/central-time";
import { prisma } from "../lib/prisma";
import { POSITION_RACE_ORDER, type PositionRaceKey } from "../lib/position-races/types";

const TARGET = parseCentralDateTime("2026-09-13", "10:00");
const APPLY = process.argv.includes("--apply");

function positionFromTitle(title: string): PositionRaceKey | null {
  const upper = title.toUpperCase();
  for (const pos of POSITION_RACE_ORDER) {
    if (new RegExp(`\\b${pos}\\b`).test(upper)) return pos;
  }
  return null;
}

function isNoiseTitle(title: string): boolean {
  return /smoke|empty pool|qa |prod verify|import smoke/i.test(title);
}

async function main() {
  const rows = await prisma.contest.findMany({
    where: {
      archivedAt: null,
      week: 1,
      season: 2026,
      sport: { in: ["FOOTBALL", "NFL"] },
      OR: [
        { contestType: "POSITION_WEEKLY" },
        { title: { contains: "Race", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      startTime: true,
      lockedAt: true,
      lockSource: true,
      settledAt: true,
      contestType: true,
      _count: { select: { tickets: true } },
      lanes: {
        select: {
          position: true,
          closingWinOddsTo1: true,
          closingPlaceOddsTo1: true,
          closingShowOddsTo1: true,
        },
        take: 8,
      },
      series: { select: { name: true, isPrivate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byPos = new Map<PositionRaceKey, (typeof rows)[number]>();
  for (const row of rows) {
    if (isNoiseTitle(row.title)) continue;
    if (row.series?.isPrivate) continue;
    const fromLane = row.lanes
      .map((l) => (l.position ?? "").toUpperCase())
      .find((p): p is PositionRaceKey =>
        POSITION_RACE_ORDER.includes(p as PositionRaceKey)
      );
    const pos = fromLane ?? positionFromTitle(row.title);
    if (!pos || byPos.has(pos)) continue;
    byPos.set(pos, row);
  }

  console.log(`Target lock: ${formatLockTimeCt(TARGET)} (${TARGET.toISOString()})`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  if (byPos.size === 0) {
    console.log("No production-like Week 1 QB/RB/WR/TE races found in this database.");
    console.log("Noise-filtered candidates were:");
    for (const r of rows) {
      console.log(`- ${r.title} [${r.status}] ${r.startTime.toISOString()}`);
    }
    process.exitCode = 1;
    return;
  }

  for (const pos of POSITION_RACE_ORDER) {
    const row = byPos.get(pos);
    if (!row) {
      console.log(`[missing] ${pos}`);
      continue;
    }
    const snap = loadContestLockSnapshot(row);
    const plan = planLockTimeUpdate(snap, TARGET, "auto");
    console.log(
      `[${pos}] ${row.title}\n  id=${row.id}\n  series=${row.series?.name}\n  status=${row.status} tickets=${snap.ticketCount}\n  current=${formatLockTimeCt(row.startTime)}\n  willReopen=${plan.willReopen} clearSnapshots=${plan.willClearClosingSnapshots}\n  blocked=${plan.blockedReason ?? "none"}`
    );

    if (APPLY && !plan.blockedReason && !plan.requiresManualConfirmation) {
      const result = await prisma.$transaction((tx) =>
        applyLockTimeUpdate(tx, plan, { adminUserId: "script:correct-week1-lock-times" })
      );
      console.log(`  → ${result.message}`);
    }
  }

  if (APPLY) {
    const verify = await prisma.contest.findMany({
      where: { id: { in: [...byPos.values()].map((r) => r.id) } },
      select: {
        id: true,
        title: true,
        status: true,
        startTime: true,
        lockedAt: true,
        lanes: {
          select: { closingWinOddsTo1: true },
          where: { closingWinOddsTo1: { not: null } },
          take: 1,
        },
        _count: { select: { tickets: true } },
      },
    });
    console.log("\nVerification:");
    for (const v of verify) {
      console.log(
        `- ${v.title}: ${v.status} lock=${v.startTime.toISOString()} tickets=${v._count.tickets} closingOdds=${
          v.lanes.length ? "PRESENT" : "cleared"
        }`
      );
      if (v.status !== ContestStatus.PUBLISHED && v.status !== ContestStatus.DRAFT) {
        console.warn(`  WARN: expected open/published`);
      }
      if (v.startTime.toISOString() !== TARGET.toISOString()) {
        console.warn(`  WARN: startTime mismatch`);
      }
    }
  } else {
    console.log("\nRe-run with --apply to write changes.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
