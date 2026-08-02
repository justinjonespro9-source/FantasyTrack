import { describe, expect, it } from "vitest";
import { formatMobileWinOdds } from "@/lib/contest/mobile-odds";

describe("formatMobileWinOdds", () => {
  it("prefers live multiples", () => {
    expect(formatMobileWinOdds(1.53, 5)).toBe("1.53x");
  });

  it("converts opening odds-to-1 into a multiple", () => {
    expect(formatMobileWinOdds(null, 5)).toBe("6.00x");
  });

  it("returns em dash when unavailable", () => {
    expect(formatMobileWinOdds(null, null)).toBe("—");
  });
});
