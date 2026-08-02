import { describe, expect, it } from "vitest";
import { maxValidQuickEntryAmount } from "@/lib/contest/quick-entry-amount";

describe("maxValidQuickEntryAmount", () => {
  it("caps single entries by remaining allocation in $5 steps", () => {
    expect(maxValidQuickEntryAmount("WIN", 12)).toBe(10);
    expect(maxValidQuickEntryAmount("WIN", 100)).toBe(100);
  });

  it("caps WPS by 3x charge and per-pool max", () => {
    expect(maxValidQuickEntryAmount("WPS", 45)).toBe(15);
    expect(maxValidQuickEntryAmount("WPS", 200)).toBe(30);
    expect(maxValidQuickEntryAmount("WPS", 10)).toBe(0);
  });
});
