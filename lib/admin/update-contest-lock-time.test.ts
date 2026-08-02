import { ContestStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseCentralDateTime } from "@/lib/contest/central-time";
import {
  planLockTimeUpdate,
  type ContestLockTimeSnapshot,
} from "./update-contest-lock-time";

const NOW = new Date("2026-08-02T15:00:00.000Z");
const FUTURE = parseCentralDateTime("2026-09-13", "10:00");

function base(overrides: Partial<ContestLockTimeSnapshot> = {}): ContestLockTimeSnapshot {
  return {
    id: "c1",
    title: "NFL 2026 Week 1 QB Race",
    status: ContestStatus.LOCKED,
    startTime: new Date("2026-08-01T15:00:00.000Z"),
    lockedAt: new Date("2026-08-01T15:00:01.000Z"),
    lockSource: "AUTO",
    settledAt: null,
    ticketCount: 14,
    hasClosingSnapshots: true,
    ...overrides,
  };
}

describe("planLockTimeUpdate", () => {
  it("auto-reopens an auto-locked contest when lock moves to the future", () => {
    const plan = planLockTimeUpdate(base(), FUTURE, "auto", NOW);
    expect(plan.willReopen).toBe(true);
    expect(plan.willClearClosingSnapshots).toBe(true);
    expect(plan.blockedReason).toBeNull();
    expect(plan.messagePreview).toContain("reopened");
  });

  it("requires confirmation for manually locked contests", () => {
    const plan = planLockTimeUpdate(
      base({ lockSource: "MANUAL" }),
      FUTURE,
      "auto",
      NOW
    );
    expect(plan.requiresManualConfirmation).toBe(true);
    expect(plan.willReopen).toBe(false);
  });

  it("reopens manually locked contests when Update and Reopen is chosen", () => {
    const plan = planLockTimeUpdate(
      base({ lockSource: "MANUAL" }),
      FUTURE,
      "update_and_reopen",
      NOW
    );
    expect(plan.willReopen).toBe(true);
    expect(plan.willClearClosingSnapshots).toBe(true);
  });

  it("updates time only for manually locked contests when requested", () => {
    const plan = planLockTimeUpdate(
      base({ lockSource: "MANUAL" }),
      FUTURE,
      "time_only",
      NOW
    );
    expect(plan.willReopen).toBe(false);
    expect(plan.willClearClosingSnapshots).toBe(false);
  });

  it("blocks settled contests", () => {
    const plan = planLockTimeUpdate(
      base({ status: ContestStatus.SETTLED, settledAt: NOW }),
      FUTURE,
      "auto",
      NOW
    );
    expect(plan.blockedReason).toMatch(/Settled/);
    expect(plan.willReopen).toBe(false);
  });

  it("does not reopen when new lock remains in the past", () => {
    const past = new Date("2026-08-01T12:00:00.000Z");
    const plan = planLockTimeUpdate(base(), past, "auto", NOW);
    expect(plan.willReopen).toBe(false);
    expect(plan.warnings).toContain("PAST_LOCK_TIME");
  });

  it("treats legacy null lockSource like auto-lock for reopen", () => {
    const plan = planLockTimeUpdate(base({ lockSource: null }), FUTURE, "auto", NOW);
    expect(plan.willReopen).toBe(true);
  });

  it("keeps published contests open and only changes startTime", () => {
    const plan = planLockTimeUpdate(
      base({ status: ContestStatus.PUBLISHED, lockedAt: null, hasClosingSnapshots: false }),
      FUTURE,
      "auto",
      NOW
    );
    expect(plan.willReopen).toBe(false);
    expect(plan.messagePreview).toContain("Sep 13, 2026");
  });
});
