import { describe, expect, it } from "vitest";
import {
  formatLockTimeCt,
  parseCentralDateTime,
  toCentralDateTimeParts,
} from "./central-time";

describe("central-time", () => {
  it("converts 2026-09-13 10:00 America/Chicago to 2026-09-13T15:00:00.000Z (CDT)", () => {
    const utc = parseCentralDateTime("2026-09-13", "10:00");
    expect(utc.toISOString()).toBe("2026-09-13T15:00:00.000Z");
  });

  it("converts a winter CST wall time with a 6-hour offset", () => {
    // Jan 15 2026 is CST (UTC-6)
    const utc = parseCentralDateTime("2026-01-15", "10:00");
    expect(utc.toISOString()).toBe("2026-01-15T16:00:00.000Z");
  });

  it("round-trips CT parts for the Week 1 lock instant", () => {
    const parts = toCentralDateTimeParts(new Date("2026-09-13T15:00:00.000Z"));
    expect(parts).toEqual({ date: "2026-09-13", time: "10:00" });
  });

  it("formats CT display label", () => {
    expect(formatLockTimeCt(new Date("2026-09-13T15:00:00.000Z"))).toBe(
      "Sep 13, 2026 · 10:00 AM CT"
    );
  });

  it("rejects malformed date/time", () => {
    expect(() => parseCentralDateTime("09/13/2026", "10:00")).toThrow(/Invalid date/);
    expect(() => parseCentralDateTime("2026-09-13", "10")).toThrow(/Invalid time/);
  });
});
