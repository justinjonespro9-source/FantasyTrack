"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCoins } from "@/lib/format";

type TapeItem = {
  id: string;
  createdAt: string;
  market: string; // "WIN" | "PLACE" | "SHOW" | etc
  lane: string;
  amount: number;
};

type DisplayTapeItem = TapeItem & {
  // When we collapse a WPS triplet, we set market to "WPS"
  market: string;
};

function buildHeadline(item: DisplayTapeItem | null) {
  if (!item) return "LIVE TAPE • Waiting for first bet…";

  // For WPS we show the per-leg amount (e.g. "$5 WPS") rather than "$15 total"
  if (item.market === "WPS") {
    return `LIVE TAPE • BET PLACED • WPS • ${item.lane} • ${formatCoins(item.amount)} WPS`;
  }

  return `LIVE TAPE • BET PLACED • ${item.market} • ${item.lane} • ${formatCoins(item.amount)}`;
}

/**
 * Collapse consecutive WIN+PLACE+SHOW legs into a single "WPS" item when:
 * - Same lane label
 * - Same amount on each leg
 * - Markets are exactly WIN/PLACE/SHOW
 * - Created within a short time window (default 2s)
 *
 * This avoids the tape "looking like SHOW only" when a WPS bet is placed.
 */
function collapseWpsTapeItems(items: TapeItem[], windowMs = 2000): DisplayTapeItem[] {
  const out: DisplayTapeItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const b = items[i + 1];
    const c = items[i + 2];

    if (!a || !b || !c) {
      out.push(a as DisplayTapeItem);
      continue;
    }

    // Must be same lane and same amount (your WPS endpoint creates 3 equal legs)
    const sameLane = a.lane === b.lane && a.lane === c.lane;
    const sameAmt = a.amount === b.amount && a.amount === c.amount;

    // Must be WIN/PLACE/SHOW (any order)
    const markets = new Set([a.market, b.market, c.market]);
    const isWpsTriplet =
      markets.size === 3 && markets.has("WIN") && markets.has("PLACE") && markets.has("SHOW");

    // Must be close in time (so we don't accidentally combine separate bets)
    const tA = new Date(a.createdAt).getTime();
    const tC = new Date(c.createdAt).getTime();
    const closeInTime = Number.isFinite(tA) && Number.isFinite(tC) && Math.abs(tA - tC) <= windowMs;

    if (sameLane && sameAmt && isWpsTriplet && closeInTime) {
      out.push({
        id: `wps-${a.id}-${c.id}`, // synthetic id
        createdAt: a.createdAt, // newest timestamp
        market: "WPS",
        lane: a.lane,
        amount: a.amount, // per-leg amount (so it reads "$5 WPS")
      });

      i += 2; // skip b and c
      continue;
    }

    out.push(a as DisplayTapeItem);
  }

  return out;
}

export function ContestLiveTape({ contestId }: { contestId: string }) {
  const [items, setItems] = useState<TapeItem[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/contest/${contestId}/tape`, { cache: "no-store" });
      const data = await res.json();

      const next: TapeItem[] = (data?.tape ?? []).filter((x: TapeItem) => x?.id);

      // De-dupe (server ids only)
      const merged: TapeItem[] = [];
      for (const x of next) {
        if (seen.current.has(x.id)) continue;
        seen.current.add(x.id);
        merged.push(x);
      }

      if (merged.length === 0) return;

      // Prepend new items, cap length
      setItems((prev) => [...merged, ...prev].slice(0, 50));

      // Auto-scroll to top so newest activity is always visible
      setTimeout(() => {
        listRef.current?.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 50);
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  // ✅ Use collapsed items for BOTH the headline and the vertical list
  const displayItems = useMemo(() => collapseWpsTapeItems(items), [items]);

  const latest = displayItems.length > 0 ? displayItems[0] : null;
  const headline = useMemo(() => buildHeadline(latest), [latest]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-amber-200/80">Live tape</div>
        <div className="text-[11px] text-neutral-400">{loading ? "loading…" : "live"}</div>
      </div>

      {/* ✅ Horizontal crawl strip */}
      <div className="mb-2 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80">
        <div className="relative">
          <div className="ticker-track">
            {/* Duplicate the text so it loops cleanly */}
            <span className="ticker-item">{headline}</span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">{headline}</span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">{headline}</span>
          </div>
        </div>
      </div>

      {/* ✅ Vertical scroll box */}
      <div
        ref={listRef}
        className="h-[160px] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/80 p-2"
      >
        {displayItems.length === 0 ? (
          <div className="text-sm text-neutral-400">No activity yet.</div>
        ) : (
          <ul className="space-y-1">
            {displayItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-100">
                  <span className="mr-2 rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-neutral-200">
                    {it.market}
                  </span>
                  {it.lane}
                </span>

                <span className={it.amount >= 50 ? "font-semibold text-emerald-300" : "text-neutral-400"}>
                  {it.market === "WPS" ? `${formatCoins(it.amount)} WPS` : formatCoins(it.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 text-[11px] text-neutral-500">
        Anonymous • Submitted tickets only
      </div>

      {/* Marquee CSS (scoped) */}
      <style jsx>{`
        .ticker-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          gap: 10px;
          padding: 8px 10px;
          animation: tickerMove 14s linear infinite;
          will-change: transform;
        }
        .ticker-item {
          font-size: 12px;
          color: #e5e5e5;
        }
        .ticker-sep {
          font-size: 12px;
          color: #9ca3af;
        }
        @keyframes tickerMove {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
      `}</style>
    </div>
  );
}