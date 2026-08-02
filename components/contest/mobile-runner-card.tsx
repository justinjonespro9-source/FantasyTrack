"use client";

import { memo } from "react";
import { formatCoins } from "@/lib/format";
import { formatMobileWinOdds } from "@/lib/contest/mobile-odds";

export type MobileRunnerCardData = {
  id: string;
  name: string;
  team: string;
  opponent?: string | null;
  depthRole?: string | null;
  status: string;
  openingWinOddsTo1: number | null;
  liveWinMultiple: number | null;
  marketRank: number | null;
  projectedRank: number | null;
  projectedPoints: string | null;
  poolShareLabel: string;
  userEntryLabel: string | null;
  isScratched: boolean;
};

type MobileRunnerCardProps = {
  runner: MobileRunnerCardData;
  onQuickEntry: (laneId: string) => void;
};

function MobileRunnerCardInner({ runner, onQuickEntry }: MobileRunnerCardProps) {
  const odds = formatMobileWinOdds(runner.liveWinMultiple, runner.openingWinOddsTo1);
  const matchup = runner.opponent
    ? `vs ${runner.opponent}${runner.depthRole ? ` · ${runner.depthRole}` : ""}`
    : runner.depthRole || runner.team;

  return (
    <article
      className={[
        "rounded-xl border px-3 py-2.5",
        runner.isScratched
          ? "border-white/[0.06] bg-black/25 opacity-60"
          : "border-white/[0.08] bg-black/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span className="mt-0.5 w-8 shrink-0 text-base font-bold tabular-nums text-ft-gold">
            {runner.marketRank != null ? `#${runner.marketRank}` : "—"}
          </span>
          <div className="min-w-0">
            <p
              className={[
                "text-base font-semibold leading-snug text-neutral-50",
                runner.isScratched ? "line-through text-neutral-500" : "",
              ].join(" ")}
            >
              {runner.name}
              {runner.team ? (
                <span className="font-medium text-neutral-400">, {runner.team}</span>
              ) : null}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-base font-bold tabular-nums text-neutral-50">{odds}</p>
      </div>

      <p className="mt-1 pl-10 text-[12px] leading-snug text-neutral-500">
        <span>{matchup}</span>
        <span className="mx-1.5 text-neutral-700">·</span>
        <span className="tabular-nums">{runner.poolShareLabel}</span>
        <span className="mx-1.5 text-neutral-700">·</span>
        <span>
          Proj #{runner.projectedRank ?? "—"}
          {runner.projectedPoints ? ` · ${runner.projectedPoints}` : ""}
        </span>
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2 pl-10">
        <p className="min-w-0 truncate text-[12px] text-neutral-400">
          {runner.userEntryLabel ? (
            <>
              Your entry:{" "}
              <span className="font-semibold text-ft-gold">{runner.userEntryLabel}</span>
            </>
          ) : (
            <span className="text-neutral-600">No entry yet</span>
          )}
        </p>
        <button
          type="button"
          disabled={runner.isScratched}
          onClick={() => onQuickEntry(runner.id)}
          className="inline-flex h-11 min-w-[7.5rem] shrink-0 items-center justify-center rounded-full border border-ft-gold/40 bg-ft-gold/10 px-3 text-sm font-semibold text-ft-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Quick Entry
        </button>
      </div>
    </article>
  );
}

function runnerPropsEqual(
  prev: MobileRunnerCardProps,
  next: MobileRunnerCardProps
): boolean {
  const a = prev.runner;
  const b = next.runner;
  return (
    prev.onQuickEntry === next.onQuickEntry &&
    a.id === b.id &&
    a.name === b.name &&
    a.team === b.team &&
    a.opponent === b.opponent &&
    a.depthRole === b.depthRole &&
    a.status === b.status &&
    a.openingWinOddsTo1 === b.openingWinOddsTo1 &&
    a.liveWinMultiple === b.liveWinMultiple &&
    a.marketRank === b.marketRank &&
    a.projectedRank === b.projectedRank &&
    a.projectedPoints === b.projectedPoints &&
    a.poolShareLabel === b.poolShareLabel &&
    a.userEntryLabel === b.userEntryLabel &&
    a.isScratched === b.isScratched
  );
}

export const MobileRunnerCard = memo(MobileRunnerCardInner, runnerPropsEqual);

export function formatUserEntryLabel(
  lines: Array<{ market: string; amount: number }>
): string | null {
  if (!lines.length) return null;
  const byMarket = new Map<string, number>();
  for (const line of lines) {
    byMarket.set(line.market, (byMarket.get(line.market) ?? 0) + line.amount);
  }
  const parts = ["WIN", "PLACE", "SHOW"]
    .filter((m) => (byMarket.get(m) ?? 0) > 0)
    .map((m) => `${formatCoins(byMarket.get(m)!)} ${m}`);
  return parts.length ? parts.join(" · ") : null;
}
