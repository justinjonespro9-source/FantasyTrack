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
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-50">
            {current.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            {current.subhead}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs sm:flex-row sm:items-center">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-neutral-800 bg-neutral-950/80 px-1 py-1">
            <button
              type="button"
              onClick={() => setSelectedTabId("overall")}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (selectedTabId === "overall"
                  ? "bg-amber-400 text-neutral-950"
                  : "bg-transparent text-neutral-300 hover:bg-neutral-800")
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
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (selectedTabId === series.id
                      ? "bg-amber-400 text-neutral-950"
                      : "bg-transparent text-neutral-300 hover:bg-neutral-800")
                  }
                >
                  {series.name}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={jumpToMyRank}
              disabled={!hasMyRank}
              className="rounded-full border border-neutral-700 bg-neutral-950/80 px-3 py-1 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 hover:border-amber-400 hover:text-amber-200"
            >
              Jump to My Rank
            </button>
            <button
              type="button"
              onClick={backToTop}
              className="rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-300 hover:border-amber-400 hover:text-amber-200"
            >
              Back to Top
            </button>
          </div>
        </div>
      </div>

      {current.entries.length === 0 ? (
        <p className="text-sm text-neutral-400">No entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-2 pr-4">Move</th>
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Skill Score</th>
                <th className="py-2 pr-4">ROI</th>
                <th className="py-2 pr-4">Winning Contest %</th>
                <th className="py-2 pr-4">Contests</th>
                <th className="py-2 pr-4">Wagered</th>
                <th className="py-2">Eligibility</th>
              </tr>
            </thead>
            <tbody className="text-neutral-100">
              {current.entries.map((row) => {
                const isMe = currentUserId != null && row.userId === currentUserId;
                const rowClasses = [
                  "border-b border-neutral-800/70 hover:bg-neutral-900/70",
                  isMe ? "bg-amber-500/5 ring-1 ring-amber-400/60" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr
                    key={`${current.id}-${row.userId}`}
                    id={`lb-row-${current.id}-${row.userId}`}
                    className={rowClasses}
                  >
                    <td className="py-2 pr-4 text-xs text-neutral-500 tabular-nums">
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
                          <span className="rounded-full border border-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                            You
                          </span>
                        )}
                        {row.primaryBadge ? (
                          <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
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
                    <td className="py-2">
                      {row.eligible ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                          Eligible
                        </span>
                      ) : (
                        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                          Not eligible
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

