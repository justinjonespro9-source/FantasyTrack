"use client";

import { useMemo, useState } from "react";
import type { LeaderboardEntry } from "@/lib/market";
import { formatCoins } from "@/lib/format";

type LeaderboardEntryWithBadge = LeaderboardEntry & {
  primaryBadge?: { label: string } | null;
};

type SeriesLeaderboard = {
  id: string;
  name: string;
  entries: LeaderboardEntryWithBadge[];
};

type Props = {
  overall: LeaderboardEntryWithBadge[];
  seriesLeaderboards: SeriesLeaderboard[];
  currentUserId: string | null;
};

export function LeaderboardClient({
  overall,
  seriesLeaderboards,
  currentUserId,
}: Props) {
  const hasSeriesTabs = seriesLeaderboards.length > 0;
  const [selectedTabId, setSelectedTabId] = useState<string>("overall");

  const current = useMemo(() => {
    if (selectedTabId === "overall") {
      return {
        id: "overall",
        title: "Overall Leaderboard",
        subhead:
          "Global FantasyTrack rankings, ordered by Skill Score across all eligible contests.",
        entries: overall,
      };
    }
    const series = seriesLeaderboards.find((s) => s.id === selectedTabId);
    if (!series) {
      return {
        id: "overall",
        title: "Overall Leaderboard",
        subhead:
          "Global FantasyTrack rankings, ordered by Skill Score across all eligible contests.",
        entries: overall,
      };
    }
    return {
      id: series.id,
      title: series.name,
      subhead:
        "Series-only Skill Score for this track. Only contests in this series are included.",
      entries: series.entries,
    };
  }, [overall, selectedTabId, seriesLeaderboards]);

  const myIndex =
    currentUserId != null
      ? current.entries.findIndex((row) => row.userId === currentUserId)
      : -1;
  const hasMyRank = myIndex >= 0;

  function jumpToMyRank() {
    if (!hasMyRank || !currentUserId) return;
    const rowId = `lb-row-${current.id}-${currentUserId}`;
    const el = document.getElementById(rowId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="ft-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">{current.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">{current.subhead}</p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs sm:flex-row sm:items-center">
          <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/40 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setSelectedTabId("overall")}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition duration-ft " +
                (selectedTabId === "overall"
                  ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                  : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200")
              }
            >
              Overall
            </button>
            {hasSeriesTabs &&
              seriesLeaderboards.map((series) => (
                <button
                  key={series.id}
                  type="button"
                  onClick={() => setSelectedTabId(series.id)}
                  className={
                    "max-w-[10rem] truncate rounded-full px-3 py-1.5 text-xs font-semibold transition duration-ft " +
                    (selectedTabId === series.id
                      ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                      : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200")
                  }
                >
                  {series.name}
                </button>
              ))}
          </div>
          {!hasSeriesTabs ? (
            <span className="text-[11px] text-neutral-500">No series leaderboards available yet.</span>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={jumpToMyRank}
              disabled={!hasMyRank}
              className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition duration-ft hover:border-ft-gold/35 hover:text-ft-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              My rank
            </button>
            <button
              type="button"
              onClick={backToTop}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:border-white/20 hover:text-neutral-300"
            >
              Top
            </button>
          </div>
        </div>
      </div>

      {current.entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-ft border border-white/[0.06]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/[0.08] bg-ft-charcoal/90 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                <th className="py-3 pl-3 pr-4">Move</th>
                <th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Skill</th>
                <th className="py-3 pr-4">ROI</th>
                <th className="py-3 pr-4">Win %</th>
                <th className="py-3 pr-4">#</th>
                <th className="py-3 pr-4">Wagered</th>
                <th className="py-3 pr-3">Eligible</th>
              </tr>
            </thead>
            <tbody className="text-neutral-100">
              {current.entries.map((row) => {
                const isMe = currentUserId != null && row.userId === currentUserId;
                const rowClasses = [
                  "border-b border-white/[0.04] transition-colors duration-ft hover:bg-white/[0.03]",
                  isMe ? "bg-ft-gold/8 ring-1 ring-inset ring-ft-gold/30" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr
                    key={`${current.id}-${row.userId}`}
                    id={`lb-row-${current.id}-${row.userId}`}
                    className={rowClasses}
                  >
                    <td className="py-2.5 pl-3 pr-4 text-xs text-neutral-500 tabular-nums">
                      {/* Placeholder for future rank movement indicators */}
                      &mdash;
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{row.rank}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-50">
                          {row.displayName}
                        </span>
                        {isMe && (
                          <span className="rounded-full border border-ft-gold/40 bg-ft-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
                            You
                          </span>
                        )}
                        {row.primaryBadge ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                            {row.primaryBadge.label}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.skillScore.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {(row.roi * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {(row.podiumRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {row.settledContests}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatCoins(row.totalWagered)}
                    </td>
                    <td className="py-2 pr-3">
                      {row.eligible ? (
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300/95">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-neutral-500">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

