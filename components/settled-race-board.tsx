"use client";

import { useState } from "react";
import { formatCoins, formatMultiple, formatOddsTo1 } from "@/lib/format";
import type { ScoringBreakdown } from "@/lib/scoring-config";
import { ScoringBreakdownAccordion } from "@/components/scoring/scoring-breakdown-accordion";

type LaneStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "SCRATCHED";

type SettledLaneRow = {
  id: string;
  name: string;
  team: string;
  position: string;
  status: LaneStatus;
  finalRank: number | null;
  fantasyPoints: number | null;
  openingWinOddsTo1: number | null;
  winTotal: number;
  placeTotal: number;
  showTotal: number;
  winMultiple: number | null;
  placeMultiple: number | null;
  showMultiple: number | null;
  scoringBreakdown?: ScoringBreakdown | null;
};

function formatLaneDisplayName(
  name: string,
  position?: string | null,
  team?: string | null
): string {
  // No position/team — show full name (e.g. homepage sample board, or name-only lanes)
  if (!position && !team) return name.trim();

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const shortName =
    parts.length <= 1 ? name : `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;

  if (position && team) return `${shortName} (${position}) ${team}`;
  if (position) return `${shortName} (${position})`;
  if (team) return `${shortName} ${team}`;
  return shortName;
}

function renderLaneStatus(status: LaneStatus) {
  switch (status) {
    case "QUESTIONABLE":
      return (
        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-200">
          Questionable
        </span>
      );
    case "DOUBTFUL":
      return (
        <span className="rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-200">
          Doubtful
        </span>
      );
    case "SCRATCHED":
      return (
        <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-200">
          Scratched
        </span>
      );
    default:
      return null;
  }
}

function settledWinOddsPrimary(winMultiple: number | null, openingWinOddsTo1: number | null): string {
  if (winMultiple != null) {
    const oddsTo1 = winMultiple - 1;
    return oddsTo1 >= 1 ? formatOddsTo1(oddsTo1) : `${winMultiple.toFixed(2)}x`;
  }
  if (openingWinOddsTo1 != null) {
    return formatOddsTo1(openingWinOddsTo1);
  }
  return "—";
}

function formatFantasyPoints(value: number | null) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function medalStyle(rank: number | null) {
  if (rank === 1) return "bg-neutral-900/70";
  if (rank === 2) return "bg-neutral-900/50";
  if (rank === 3) return "bg-neutral-900/30";
  return "bg-neutral-900/10";
}

function podiumMedal(rank: number | null) {
  switch (rank) {
    case 1:
      return null;
    case 2:
      return null;
    case 3:
      return null;
    default:
      return null;
  }
}

function podiumRankClass(rank: number | null) {
  switch (rank) {
    case 1:
      return "border-ft-gold/50 bg-ft-gold/12 text-ft-gold-bright";
    case 2:
      return "border-zinc-500/80 bg-zinc-500/10 text-zinc-100";
    case 3:
      return "border-orange-500/80 bg-orange-500/10 text-orange-100";
    default:
      return "border-zinc-700/90 bg-zinc-800/80 text-zinc-100";
  }
}

function podiumLabel(rank: number | null) {
  switch (rank) {
    case 1:
      return "Win";
    case 2:
      return "Place";
    case 3:
      return "Show";
    default:
      return rank != null ? `Rank #${rank}` : "—";
  }
}

export function SettledRaceBoard({ rows }: { rows: SettledLaneRow[] }) {
  const [openScoringLaneId, setOpenScoringLaneId] = useState<string | null>(null);

  const sortedRows = [...rows].sort((a, b) => {
    const aRank = a.finalRank ?? 9999;
    const bRank = b.finalRank ?? 9999;
    if (aRank !== bRank) return aRank - bRank;

    const aPts = a.fantasyPoints ?? -9999;
    const bPts = b.fantasyPoints ?? -9999;
    if (aPts !== bPts) return bPts - aPts;

    return a.name.localeCompare(b.name);
  });

  return (
    <div className="overflow-x-auto rounded-ft-lg border border-white/[0.08] bg-gradient-to-b from-black/90 via-ft-charcoal/95 to-black shadow-inner">
      <table className="min-w-full text-sm text-neutral-100">
        <thead className="text-left">
          <tr>
            <th className="min-w-[7rem] border-b border-ft-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              WIN (final / open)
            </th>
            <th className="border-b border-ft-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              Player
            </th>
            <th className="border-b border-ft-gold/25 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              Pts
            </th>
            <th className="border-b border-ft-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              Win pool
            </th>
            <th className="border-b border-ft-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              Place pool
            </th>
            <th className="border-b border-ft-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold/90">
              Show pool
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((lane) => {
            const playerLabel = formatLaneDisplayName(lane.name, lane.position, lane.team);

            return (
              <tr
                key={lane.id}
                className={[
                  "border-t border-white/[0.06] transition-colors hover:bg-white/[0.04]",
                  medalStyle(lane.finalRank),
                  lane.status === "SCRATCHED" ? "opacity-60" : "",
                ].join(" ")}
              >
                <td className="min-w-[7rem] px-3 py-2 align-top">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 shrink">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                        {lane.winMultiple != null ? "Final pool" : lane.openingWinOddsTo1 != null ? "Opening line" : ""}
                      </p>
                      <span className="shrink-0 whitespace-nowrap text-lg font-bold text-ft-gold tabular-nums">
                        {settledWinOddsPrimary(lane.winMultiple, lane.openingWinOddsTo1)}
                      </span>
                    </div>
                    {lane.finalRank && lane.finalRank <= 3 ? (
                      <span
                        className={
                          [
                            "inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide",
                            lane.finalRank <= 3
                              ? "px-2 py-0.5 text-[11px]"
                              : "px-1.5 py-0.5 text-[10px]",
                            podiumRankClass(lane.finalRank),
                          ].join(" ")
                        }
                      >
                        {podiumLabel(lane.finalRank)}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="px-3 py-2 align-top">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        "block truncate font-medium text-neutral-50",
                        lane.status === "SCRATCHED" ? "text-neutral-500 line-through" : "",
                      ].join(" ")}
                    >
                      {playerLabel}
                    </span>
                    {renderLaneStatus(lane.status) ? (
                      <span className="inline-flex shrink-0">{renderLaneStatus(lane.status)}</span>
                    ) : null}
                  </div>
                </td>

                {/* Pts column + scoring breakdown */}
                <td className="px-3 py-2 align-top text-center">
                  <span className="inline-block min-w-[3.5rem] whitespace-nowrap text-xs font-medium text-neutral-300">
                    {formatFantasyPoints(lane.fantasyPoints)} pts
                  </span>
                  <ScoringBreakdownAccordion
                    breakdown={lane.scoringBreakdown}
                    open={openScoringLaneId === lane.id}
                    onToggle={() =>
                      setOpenScoringLaneId(
                        openScoringLaneId === lane.id ? null : lane.id
                      )
                    }
                  />
                </td>

                <td className="px-3 py-2 align-top">
                  <p className="font-medium text-neutral-50 tabular-nums">{formatCoins(lane.winTotal)}</p>
                  {lane.winMultiple != null ? (
                    <p className="text-xs text-amber-300/80">{formatMultiple(lane.winMultiple)}</p>
                  ) : null}
                </td>

                <td className="px-3 py-2 align-top">
                  <p className="font-medium text-neutral-50 tabular-nums">{formatCoins(lane.placeTotal)}</p>
                  {lane.placeMultiple != null ? (
                    <p className="text-xs text-amber-300/80">{formatMultiple(lane.placeMultiple)}</p>
                  ) : null}
                </td>

                <td className="px-3 py-2 align-top">
                  <p className="font-medium text-neutral-50 tabular-nums">{formatCoins(lane.showTotal)}</p>
                  {lane.showMultiple != null ? (
                    <p className="text-xs text-amber-300/80">{formatMultiple(lane.showMultiple)}</p>
                  ) : null}
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}