import { MAX_BET_AMOUNT, MIN_BET_AMOUNT } from "@/lib/constants";

const MAX_WPS_PER_POOL = 30;

export type QuickEntryAmountMode = "WIN" | "PLACE" | "SHOW" | "WPS";

/** Max valid entry amount for the selected mode, in $5 steps. */
export function maxValidQuickEntryAmount(
  mode: QuickEntryAmountMode,
  remainingAllocation: number
): number {
  if (mode === "WPS") {
    const byAllocation = Math.floor(remainingAllocation / 3 / 5) * 5;
    return Math.max(0, Math.min(MAX_WPS_PER_POOL, byAllocation));
  }
  const byAllocation = Math.floor(remainingAllocation / 5) * 5;
  return Math.max(0, Math.min(MAX_BET_AMOUNT, byAllocation));
}

export function clampQuickEntryAmount(
  value: number,
  mode: QuickEntryAmountMode,
  remainingAllocation: number
): number {
  const max = maxValidQuickEntryAmount(mode, remainingAllocation);
  if (max < MIN_BET_AMOUNT) return MIN_BET_AMOUNT;
  if (!Number.isFinite(value)) return MIN_BET_AMOUNT;
  const stepped = Math.round(value / 5) * 5;
  return Math.min(max, Math.max(MIN_BET_AMOUNT, stepped));
}

export { MAX_WPS_PER_POOL };
