"use client";

import type { ScoringBreakdown } from "@/lib/scoring-config";

type Props = {
  breakdown?: ScoringBreakdown | null;
  open: boolean;
  onToggle: () => void;
};

export function ScoringBreakdownAccordion({ breakdown, open, onToggle }: Props) {
  if (!breakdown || breakdown.rows.length === 0) return null;

  return (
    <div className="mt-0.5 text-[11px] text-neutral-300">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
      >
        <span>{open ? "Hide scoring details" : "Scoring details"}</span>
        <span className="text-[10px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="mt-1 rounded border border-neutral-800 bg-neutral-950/95 px-2 py-1.5">
          <ul className="space-y-0.5">
            {breakdown.rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-neutral-300">
                  {row.label}: {row.rawValue}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-neutral-100">
                  {row.fantasyPoints >= 0 ? "+" : ""}
                  {row.fantasyPoints.toFixed(2).replace(/\.?0+$/, "")} pts
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-1 border-t border-neutral-800 pt-1 text-right text-[11px] font-semibold text-neutral-100">
            Total: {breakdown.total.toFixed(2).replace(/\.?0+$/, "")} pts
          </div>
        </div>
      )}
    </div>
  );
}

