import { describe, expect, it } from "vitest";
import { formatLockCountdown } from "@/lib/contest/lock-countdown";

const lockAt = new Date("2026-09-13T16:29:00.000Z");
const formatLockDate = () => "Sep 13 at 12:29 PM";

describe("formatLockCountdown", () => {
  it("uses absolute lock time beyond 72 hours", () => {
    expect(formatLockCountdown(1024 * 3600, lockAt, formatLockDate)).toBe(
      "Locks Sep 13 at 12:29 PM"
    );
  });

  it("uses day+hour inside 72 hours", () => {
    expect(formatLockCountdown(2 * 86400 + 4 * 3600, lockAt, formatLockDate)).toBe(
      "Locks in 2d 4h"
    );
  });

  it("uses hour+minute inside 24 hours", () => {
    expect(formatLockCountdown(4 * 3600 + 18 * 60, lockAt, formatLockDate)).toBe(
      "Locks in 4h 18m"
    );
  });

  it("uses minute+second inside 1 hour", () => {
    expect(formatLockCountdown(42 * 60 + 16, lockAt, formatLockDate)).toBe(
      "Locks in 42m 16s"
    );
  });

  it("returns Locked when expired", () => {
    expect(formatLockCountdown(0, lockAt, formatLockDate)).toBe("Locked");
  });
});
