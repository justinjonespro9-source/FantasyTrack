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

function rankPodiumClass(rank: number) {
  if (rank === 1) return "text-ft-gold-bright";
  if (rank === 2) return "text-neutral-200";
  if (rank === 3) return "text-amber-200/90";
  return "text-neutral-400";
}

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
  const myRow = hasMyRank ? current.entries[myIndex] : null;

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
    <section className="overflow-hidden rounded-ft-lg border border-white/[0.08] bg-gradient-to-b from-ft-charcoal/40 via-black/50 to-black/80 shadow-ft-card">
      <div className="relative border-b border-white/[0.06] px-5 py-6 sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-ft-radial-gold opacity-[0.35]" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="ft-label text-ft-gold/85">Standings</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
              {current.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">{current.subhead}</p>
            {myRow ? (
              <div className="mt-5 inline-flex flex-wrap items-center gap-3 rounded-ft border border-ft-gold/25 bg-ft-gold/[0.08] px-4 py-2.5 shadow-inner">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ft-gold/90">
                  Your position
                </span>
                <span className="text-lg font-bold tabular-nums text-neutral-50">#{myRow.rank}</span>
                <span className="h-4 w-px bg-white/15" aria-hidden />
                <span className="text-sm text-neutral-400">
                  Skill <span className="font-semibold text-neutral-200">{myRow.skillScore.toFixed(1)}</span>
                </span>
                <span className="text-sm text-neutral-400">
                  ROI{" "}
                  <span className="font-semibold text-neutral-200">
                    {(myRow.roi * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-4 sm:max-w-md lg:w-auto lg:items-end">
            <div className="w-full">
              <p className="ft-label mb-2 text-neutral-500 lg:text-right">View</p>
              <div className="inline-flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <div
                  className="flex w-full flex-wrap gap-1 rounded-ft-lg border border-white/[0.1] bg-black/55 p-1.5 shadow-inner backdrop-blur-sm"
                  role="tablist"
                  aria-label="Leaderboard scope"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedTabId === "overall"}
                    onClick={() => setSelectedTabId("overall")}
                    className={
                      "min-h-[2.5rem] flex-1 rounded-ft px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition duration-ft sm:min-w-[5.5rem] sm:flex-none " +
                      (selectedTabId === "overall"
                        ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                        : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200")
                    }
                  >
                    Overall
                  </button>
                  {hasSeriesTabs &&
                    seriesLeaderboards.map((series) => (
                      <button
                        key={series.id}
                        type="button"
                        role="tab"
                        aria-selected={selectedTabId === series.id}
                        onClick={() => setSelectedTabId(series.id)}
                        className={
                          "min-h-[2.5rem] max-w-full flex-1 truncate rounded-ft px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition duration-ft sm:max-w-[12rem] sm:flex-none " +
                          (selectedTabId === series.id
                            ? "bg-ft-cta text-neutral-950 shadow-ft-inner"
                            : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200")
                        }
                      >
                        {series.name}
                      </button>
                    ))}
                </div>
                {!hasSeriesTabs ? (
                  <span className="block text-center text-[11px] text-neutral-500 lg:text-right">
                    No series leaderboards available yet.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={jumpToMyRank}
                disabled={!hasMyRank}
                className="rounded-full border border-ft-gold/35 bg-ft-gold/[0.08] px-4 py-2 text-xs font-bold uppercase tracking-wide text-ft-gold transition duration-ft hover:border-ft-gold/55 hover:bg-ft-gold/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
              >
                My rank
              </button>
              <button
                type="button"
                onClick={backToTop}
                className="rounded-full border border-white/[0.1] bg-black/30 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500 transition hover:border-white/20 hover:text-neutral-300"
              >
                Top
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-5 pt-2 sm:px-5 sm:pb-7">
        {current.entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-neutral-500">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-ft border border-white/[0.06] bg-black/25 shadow-inner">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-ft-charcoal/95 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 backdrop-blur-md">
                <tr>
                  <th className="w-14 py-3.5 pl-4 pr-2 text-left font-bold">Move</th>
                  <th className="w-16 py-3.5 pr-3 text-left font-bold">Rank</th>
                  <th className="min-w-[11rem] py-3.5 pr-4 font-bold">Player</th>
                  <th className="border-l border-white/[0.06] py-3.5 pr-4 text-right font-bold">Skill</th>
                  <th className="py-3.5 pr-4 text-right font-bold">ROI</th>
                  <th className="py-3.5 pr-4 text-right font-bold">Win %</th>
                  <th className="py-3.5 pr-4 text-right font-bold">Contests</th>
                  <th className="py-3.5 pr-4 text-right font-bold">Wagered</th>
                  <th className="py-3.5 pr-4 text-right font-bold">Eligible</th>
                </tr>
              </thead>
              <tbody className="text-neutral-200">
                {current.entries.map((row) => {
                  const isMe = currentUserId != null && row.userId === currentUserId;
                  const isPodium = row.rank <= 3;
                  const rowClasses = [
                    "border-b border-white/[0.04] transition-colors duration-ft",
                    isMe
                      ? "bg-gradient-to-r from-ft-gold/[0.14] via-ft-gold/[0.06] to-transparent shadow-[inset_3px_0_0_0_rgba(212,175,55,0.65)]"
                      : "hover:bg-white/[0.04]",
                    !isMe && isPodium ? "bg-white/[0.02]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr
                      key={`${current.id}-${row.userId}`}
                      id={`lb-row-${current.id}-${row.userId}`}
                      className={rowClasses}
                    >
                      <td className="py-3.5 pl-4 pr-2 align-middle text-xs text-neutral-600 tabular-nums">
                        &mdash;
                      </td>
                      <td className="py-3.5 pr-3 align-middle">
                        <span
                          className={`inline-flex min-w-[2rem] items-center justify-center rounded-ft border border-white/[0.08] bg-black/40 px-2 py-1 text-sm font-bold tabular-nums ${rankPodiumClass(row.rank)}`}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 align-middle">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={
                              isMe
                                ? "font-bold text-neutral-50"
                                : "font-semibold text-neutral-100"
                            }
                          >
                            {row.displayName}
                          </span>
                          {isMe && (
                            <span className="rounded-full border border-ft-gold/50 bg-ft-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold shadow-sm">
                              You
                            </span>
                          )}
                          {row.primaryBadge ? (
                            <span className="inline-flex items-center rounded-full border border-ft-gold/30 bg-ft-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold/95">
                              {row.primaryBadge.label}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-l border-white/[0.05] py-3.5 pr-4 text-right align-middle text-sm font-semibold tabular-nums text-neutral-100">
                        {row.skillScore.toFixed(1)}
                      </td>
                      <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-300">
                        {(row.roi * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-300">
                        {(row.podiumRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-400">
                        {row.settledContests}
                      </td>
                      <td className="py-3.5 pr-4 text-right align-middle tabular-nums text-neutral-300">
                        {formatCoins(row.totalWagered)}
                      </td>
                      <td className="py-3.5 pr-4 text-right align-middle">
                        {row.eligible ? (
                          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
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
      </div>
    </section>
  );
}
