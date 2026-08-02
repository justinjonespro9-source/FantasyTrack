"use client";

import { Market } from "@prisma/client";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { MAX_BET_AMOUNT, MIN_BET_AMOUNT } from "@/lib/constants";
import {
  clampQuickEntryAmount,
  MAX_WPS_PER_POOL,
  maxValidQuickEntryAmount,
} from "@/lib/contest/quick-entry-amount";
import { formatCoins } from "@/lib/format";

const PRESETS = [5, 10, 25] as const;

export type QuickEntryMode = Market | "WPS";

type ExistingLine = {
  market: Market;
  amount: number;
};

type QuickEntryPanelProps = {
  laneId: string;
  playerName: string;
  currentWinOddsLabel: string;
  remainingAllocation: number;
  existingLines: ExistingLine[];
  isLoggedIn: boolean;
  bettingClosed: boolean;
  canBet: boolean;
  isScratched: boolean;
  isPending: boolean;
  poolTotals: Record<Market, number>;
  laneTotals: Record<Market, number>;
  onClose: () => void;
  onSubmitSingle: (market: Market, amount: number) => void | Promise<void>;
  onSubmitWps: (amount: number) => void | Promise<void>;
};

function projectedMultiple(
  pool: number,
  lane: number,
  amount: number
): number | null {
  if (amount <= 0 || !Number.isFinite(amount)) return null;
  const poolAfter = pool + amount;
  const laneAfter = lane + amount;
  if (laneAfter <= 0) return null;
  return poolAfter / laneAfter;
}

function EstimateInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="About pool impact estimates"
        aria-expanded={open}
        className="rounded border border-white/15 px-1.5 py-0 text-[10px] text-neutral-500 transition hover:border-ft-gold/40 hover:text-ft-gold"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⓘ
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded border border-white/10 bg-ft-charcoal p-2 text-[11px] leading-snug text-neutral-300 shadow-ft-card"
        >
          Estimates change as additional entries enter the pool.
        </span>
      ) : null}
    </span>
  );
}

export function QuickEntryPanel({
  laneId,
  playerName,
  currentWinOddsLabel,
  remainingAllocation,
  existingLines,
  isLoggedIn,
  bettingClosed,
  canBet,
  isScratched,
  isPending,
  poolTotals,
  laneTotals,
  onClose,
  onSubmitSingle,
  onSubmitWps,
}: QuickEntryPanelProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState<QuickEntryMode>(Market.WIN);
  const [amount, setAmount] = useState(String(MIN_BET_AMOUNT));

  const maxAmount = maxValidQuickEntryAmount(mode, remainingAllocation);
  const parsed = Number(amount);
  const perPool = Number.isFinite(parsed) ? parsed : 0;
  const totalCost = mode === "WPS" ? perPool * 3 : perPool;
  const remainingAfter = remainingAllocation - totalCost;

  const amountValid =
    Number.isInteger(perPool) &&
    perPool >= MIN_BET_AMOUNT &&
    perPool % 5 === 0 &&
    perPool <= (mode === "WPS" ? MAX_WPS_PER_POOL : MAX_BET_AMOUNT) &&
    totalCost <= remainingAllocation &&
    maxAmount >= MIN_BET_AMOUNT;

  const insufficient = totalCost > remainingAllocation && perPool > 0;
  const suggestedMax = maxAmount;

  const presets = useMemo(
    () => PRESETS.filter((v) => v >= MIN_BET_AMOUNT && v <= maxAmount),
    [maxAmount]
  );
  const showMaxPreset =
    maxAmount >= MIN_BET_AMOUNT && !presets.includes(maxAmount as (typeof PRESETS)[number]);

  const estimateLine = useMemo(() => {
    if (!amountValid) return null;
    if (mode === "WPS") {
      const win = projectedMultiple(poolTotals.WIN, laneTotals.WIN ?? 0, perPool);
      const place = projectedMultiple(poolTotals.PLACE, laneTotals.PLACE ?? 0, perPool);
      const show = projectedMultiple(poolTotals.SHOW, laneTotals.SHOW ?? 0, perPool);
      const parts: string[] = [];
      if (win != null) parts.push(`WIN ${win.toFixed(2)}x`);
      if (place != null) parts.push(`PLACE ${place.toFixed(2)}x`);
      if (show != null) parts.push(`SHOW ${show.toFixed(2)}x`);
      return parts.length ? `Estimated after entry: ${parts.join(" · ")}` : null;
    }
    if (mode === Market.WIN) {
      const win = projectedMultiple(poolTotals.WIN, laneTotals.WIN ?? 0, perPool);
      return win != null ? `Estimated WIN odds after entry: ${win.toFixed(2)}x` : null;
    }
    if (mode === Market.PLACE) {
      const place = projectedMultiple(poolTotals.PLACE, laneTotals.PLACE ?? 0, perPool);
      return place != null ? `Estimated PLACE odds after entry: ${place.toFixed(2)}x` : null;
    }
    const show = projectedMultiple(poolTotals.SHOW, laneTotals.SHOW ?? 0, perPool);
    return show != null ? `Estimated SHOW odds after entry: ${show.toFixed(2)}x` : null;
  }, [amountValid, mode, perPool, poolTotals, laneTotals]);

  const existingSummary = useMemo(() => {
    if (!existingLines.length) return null;
    const byMarket = new Map<Market, number>();
    for (const line of existingLines) {
      byMarket.set(line.market, (byMarket.get(line.market) ?? 0) + line.amount);
    }
    const parts = ([Market.WIN, Market.PLACE, Market.SHOW] as Market[])
      .filter((m) => (byMarket.get(m) ?? 0) > 0)
      .map((m) => `${formatCoins(byMarket.get(m)!)} ${m}`);
    return parts.length ? `You currently have ${parts.join(" · ")} on ${playerName}` : null;
  }, [existingLines, playerName]);

  useEffect(() => {
    const nextMax = maxValidQuickEntryAmount(mode, remainingAllocation);
    const current = Number(amount);
    if (!Number.isFinite(current) || (nextMax >= MIN_BET_AMOUNT && current > nextMax)) {
      setAmount(String(MIN_BET_AMOUNT));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only reclamp on mode/remaining change
  }, [mode, remainingAllocation]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [laneId]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function setClampedAmount(next: number) {
    setAmount(String(clampQuickEntryAmount(next, mode, remainingAllocation)));
  }

  function onAmountInput(raw: string) {
    if (raw === "") {
      setAmount("");
      return;
    }
    if (!/^\d*$/.test(raw)) return;
    setAmount(raw);
  }

  function onAmountBlur() {
    if (amount === "") {
      setAmount(String(MIN_BET_AMOUNT));
      return;
    }
    setClampedAmount(Number(amount));
  }

  function onAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setClampedAmount(perPool + 5);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setClampedAmount(perPool - 5);
    } else if (event.key === "Enter" && canSubmit) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  const disableReason = !isLoggedIn
    ? "Log in to enter."
    : bettingClosed
      ? "Entries closed."
      : !canBet
        ? "Race is not open for entries."
        : isScratched
          ? "Scratched runners cannot accept new entries."
          : maxAmount < MIN_BET_AMOUNT
            ? `Not enough allocation remaining (need at least ${formatCoins(mode === "WPS" ? MIN_BET_AMOUNT * 3 : MIN_BET_AMOUNT)}).`
            : insufficient
              ? `Not enough remaining allocation. Max ${mode === "WPS" ? "per pool" : "entry"} is ${formatCoins(suggestedMax)}${mode === "WPS" ? ` (${formatCoins(suggestedMax * 3)} total)` : ""}.`
              : !amountValid && perPool > 0
                ? perPool % 5 !== 0
                  ? "Entry amounts must be in $5 increments."
                  : perPool < MIN_BET_AMOUNT
                    ? `Minimum entry is ${formatCoins(MIN_BET_AMOUNT)}.`
                    : "Enter a valid amount."
                : null;

  const canSubmit =
    isLoggedIn &&
    !bettingClosed &&
    canBet &&
    !isScratched &&
    amountValid &&
    !isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (mode === "WPS") await onSubmitWps(perPool);
    else await onSubmitSingle(mode, perPool);
  }

  const ctaLabel =
    mode === "WPS"
      ? `Enter WPS · ${formatCoins(totalCost)}`
      : `Enter ${mode} · ${formatCoins(totalCost)}`;

  const modes: QuickEntryMode[] = [Market.WIN, Market.PLACE, Market.SHOW, "WPS"];

  return (
    <div
      ref={panelRef}
      id={panelId}
      role="region"
      aria-label={`Quick Entry for ${playerName}`}
      className="rounded-b-ft border border-t-0 border-ft-gold/35 bg-gradient-to-b from-ft-charcoal/98 to-black/95 px-3 py-3 text-sm shadow-[inset_0_1px_0_0_rgba(212,175,55,0.25)] sm:px-4 sm:py-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ft-gold/90">
            Quick Entry
            <span className="mx-1.5 text-neutral-600">·</span>
            <span className="tracking-normal text-neutral-100">{playerName}</span>
            <span className="mx-1.5 text-neutral-600">·</span>
            <span className="font-semibold tracking-normal text-neutral-300">
              Current WIN odds {currentWinOddsLabel}
            </span>
          </p>
          {existingSummary ? (
            <p className="mt-1 text-[11px] text-neutral-400">
              {existingSummary}.{" "}
              <a href="#bet-slip" className="font-semibold text-ft-gold hover:underline">
                Edit entries
              </a>
            </p>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close quick entry"
          onClick={onClose}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:border-ft-gold/40 hover:text-ft-gold"
        >
          ×
        </button>
      </div>

      {!isLoggedIn ? (
        <p className="mt-3 text-xs text-neutral-400">
          <Link href="/auth/login" className="font-semibold text-ft-gold underline-offset-4 hover:underline">
            Log in
          </Link>{" "}
          to enter this race.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
          <div className="space-y-2.5">
            <div
              role="radiogroup"
              aria-label="Entry type"
              className="flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-black/40 p-1"
            >
              {modes.map((m) => {
                const selected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m)}
                    className={[
                      "min-w-[3.25rem] flex-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition",
                      selected
                        ? "bg-ft-gold/15 text-ft-gold shadow-ft-inner"
                        : "text-neutral-500 hover:text-neutral-200",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            {mode === "WPS" ? (
              <p className="text-[11px] text-neutral-500">
                One entry in WIN, PLACE, and SHOW
              </p>
            ) : null}

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Entry amount{mode === "WPS" ? " (per pool)" : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease amount by five dollars"
                  disabled={isPending || maxAmount < MIN_BET_AMOUNT}
                  onClick={() => setClampedAmount(perPool - 5)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 text-neutral-200 transition hover:border-ft-gold/35 disabled:opacity-40"
                >
                  −
                </button>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Entry amount in dollars"
                    value={amount}
                    onChange={(e) => onAmountInput(e.target.value)}
                    onBlur={onAmountBlur}
                    onKeyDown={onAmountKeyDown}
                    disabled={isPending || maxAmount < MIN_BET_AMOUNT}
                    className="h-9 w-[5.5rem] rounded border border-white/10 bg-black/50 py-1 pl-6 pr-2 text-center text-base font-bold tabular-nums text-neutral-50 [appearance:textfield] disabled:opacity-40"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Increase amount by five dollars"
                  disabled={isPending || maxAmount < MIN_BET_AMOUNT}
                  onClick={() => setClampedAmount(perPool + 5)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 text-neutral-200 transition hover:border-ft-gold/35 disabled:opacity-40"
                >
                  +
                </button>
                <div className="flex flex-wrap gap-1">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isPending}
                      onClick={() => setClampedAmount(preset)}
                      className={[
                        "rounded-full border px-2 py-1 text-[10px] font-semibold tabular-nums transition",
                        perPool === preset
                          ? "border-ft-gold/40 bg-ft-gold/10 text-ft-gold"
                          : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200",
                      ].join(" ")}
                    >
                      {formatCoins(preset)}
                    </button>
                  ))}
                  {showMaxPreset ? (
                    <button
                      type="button"
                      disabled={isPending || maxAmount < MIN_BET_AMOUNT}
                      onClick={() => setClampedAmount(maxAmount)}
                      className={[
                        "rounded-full border px-2 py-1 text-[10px] font-semibold tabular-nums transition",
                        perPool === maxAmount
                          ? "border-ft-gold/40 bg-ft-gold/10 text-ft-gold"
                          : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200",
                      ].join(" ")}
                    >
                      Max
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] tabular-nums text-neutral-500">
                {mode === "WPS"
                  ? `${formatCoins(Math.max(0, perPool))} per pool · ${formatCoins(Math.max(0, totalCost))} total`
                  : `${formatCoins(Math.max(0, totalCost))} total`}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-ft border border-white/[0.07] bg-black/35 p-3">
            {estimateLine ? (
              <p className="flex flex-wrap items-start gap-1.5 text-[11px] leading-snug text-neutral-300">
                <span>{estimateLine}</span>
                <EstimateInfo />
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500">
                Pool impact estimates appear for valid amounts.
              </p>
            )}

            <p className="text-[11px] text-neutral-400">
              {mode} ·{" "}
              <span className="font-semibold tabular-nums text-neutral-100">
                {formatCoins(Math.max(0, totalCost))} total
              </span>
              {" · "}
              {remainingAfter >= 0 ? (
                <>
                  <span className="font-semibold tabular-nums text-ft-gold">
                    {formatCoins(remainingAfter)}
                  </span>{" "}
                  remaining after entry
                </>
              ) : (
                <span className="text-red-300">exceeds remaining allocation</span>
              )}
            </p>

            {disableReason && !canSubmit ? (
              <p className="text-[11px] font-medium text-amber-200/90">{disableReason}</p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="ft-btn-primary sticky bottom-0 flex min-h-10 w-full items-center justify-center px-4 text-sm font-bold disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none"
            >
              {isPending ? "Submitting…" : ctaLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
