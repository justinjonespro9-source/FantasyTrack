"use client";

import { ContestStatus, Market } from "@prisma/client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { QuickEntryPanel } from "@/components/contest/quick-entry-panel";
import { MobileBottomSheet } from "@/components/contest/mobile-bottom-sheet";
import {
  formatUserEntryLabel,
  MobileRunnerCard,
  type MobileRunnerCardData,
} from "@/components/contest/mobile-runner-card";
import { ShareContestButton } from "@/components/contest/share-contest-button";
import { formatCoins } from "@/lib/format";
import { formatPoolShare } from "@/lib/contest/format-pool-share";
import type { ContestPageEmphasis } from "@/lib/contest/page-emphasis";

export type MobileLane = {
  id: string;
  name: string;
  team: string;
  position: string;
  opponent?: string | null;
  depthRole?: string | null;
  status: string;
  openingWinOddsTo1: number | null;
  seedRank?: number | null;
  displayOrder?: number | null;
  projectedPoints?: number | null;
};

export type LaneSortKey =
  | "MARKET_RANK"
  | "PROJECTED_RANK"
  | "CURRENT_ODDS"
  | "MOST_BACKED"
  | "PLAYER";

type MobileContestBoardProps = {
  contestId: string;
  title: string;
  status: ContestStatus;
  lifecycleLabel: string;
  lockLabel: string;
  week?: number | null;
  position?: string | null;
  totalPool: number;
  entryCount: number;
  remainingAllocation: number;
  isLoggedIn: boolean;
  bettingClosed: boolean;
  canBet: boolean;
  isPending: boolean;
  pageEmphasis: ContestPageEmphasis;
  sortKey: LaneSortKey;
  onSortKeyChange: (key: LaneSortKey) => void;
  sortedLanes: MobileLane[];
  marketRanks: Map<string, number>;
  poolTotals: Record<Market, number>;
  laneTotals: Record<string, Record<Market, number>>;
  estMultiples: Record<string, Partial<Record<Market, number | null>>>;
  winPoolTotal: number;
  myBets: Array<{
    laneId: string;
    market: Market;
    amount: number;
    refunded: boolean;
    laneName: string;
  }>;
  mostBackedName: string | null;
  marketUpdatedLabel: string;
  liveBoard: ReactNode;
  resultsBoard?: ReactNode;
  secondaryContent: ReactNode;
  ticketSummary: ReactNode;
  onSubmitSingle: (
    laneId: string,
    market: Market,
    amount: number,
    playerName: string
  ) => void | Promise<void>;
  onSubmitWps: (
    laneId: string,
    amount: number,
    playerName: string
  ) => void | Promise<void>;
};

type MobileFilter = "ALL" | "RB1" | "RB2" | "MY_ENTRIES";
type MobileView = "market" | "live" | "results";

function formatProjectedPoints(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return value.toFixed(1).replace(/\.0$/, "");
}

export function MobileContestBoard({
  contestId,
  title,
  status,
  lifecycleLabel,
  lockLabel,
  week,
  position,
  totalPool,
  entryCount,
  remainingAllocation,
  isLoggedIn,
  bettingClosed,
  canBet,
  isPending,
  pageEmphasis,
  sortKey,
  onSortKeyChange,
  sortedLanes,
  marketRanks,
  poolTotals,
  laneTotals,
  estMultiples,
  winPoolTotal,
  myBets,
  mostBackedName,
  marketUpdatedLabel,
  liveBoard,
  resultsBoard,
  secondaryContent,
  ticketSummary,
  onSubmitSingle,
  onSubmitWps,
}: MobileContestBoardProps) {
  const [view, setView] = useState<MobileView>(() =>
    pageEmphasis === "LIVE" ? "live" : pageEmphasis === "FINAL" ? "results" : "market"
  );
  const [filter, setFilter] = useState<MobileFilter>("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [entryLaneId, setEntryLaneId] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    if (pageEmphasis === "LIVE") setView("live");
    else if (pageEmphasis === "FINAL") setView("results");
  }, [pageEmphasis]);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const myEntryLaneIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of myBets) {
      if (!b.refunded) set.add(b.laneId);
    }
    return set;
  }, [myBets]);

  const myTicketCount = myEntryLaneIds.size;
  const myEnteredTotal = useMemo(
    () => myBets.filter((b) => !b.refunded).reduce((sum, b) => sum + b.amount, 0),
    [myBets]
  );

  const roleFiltersAvailable = useMemo(() => {
    const roles = new Set(
      sortedLanes.map((l) => (l.depthRole ?? "").toUpperCase()).filter(Boolean)
    );
    return {
      rb1: roles.has("RB1"),
      rb2: roles.has("RB2"),
    };
  }, [sortedLanes]);

  const filteredLanes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedLanes.filter((lane) => {
      if (filter === "MY_ENTRIES" && !myEntryLaneIds.has(lane.id)) return false;
      if (filter === "RB1" && (lane.depthRole ?? "").toUpperCase() !== "RB1") return false;
      if (filter === "RB2" && (lane.depthRole ?? "").toUpperCase() !== "RB2") return false;
      if (q && !lane.name.toLowerCase().includes(q) && !lane.team.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [sortedLanes, filter, myEntryLaneIds, search]);

  const runnerCards: MobileRunnerCardData[] = useMemo(() => {
    return filteredLanes.map((lane) => {
      const winTotal = laneTotals[lane.id]?.WIN ?? 0;
      const lines = myBets
        .filter((b) => b.laneId === lane.id && !b.refunded)
        .map((b) => ({ market: b.market, amount: b.amount }));
      return {
        id: lane.id,
        name: lane.name,
        team: lane.team,
        opponent: lane.opponent,
        depthRole: lane.depthRole,
        status: lane.status,
        openingWinOddsTo1: lane.openingWinOddsTo1,
        liveWinMultiple: estMultiples[lane.id]?.WIN ?? null,
        marketRank: marketRanks.get(lane.id) ?? null,
        projectedRank: lane.seedRank ?? lane.displayOrder ?? null,
        projectedPoints: formatProjectedPoints(lane.projectedPoints),
        poolShareLabel:
          winPoolTotal > 0
            ? `${formatPoolShare(winTotal, winPoolTotal)} pool`
            : "No pool yet",
        userEntryLabel: formatUserEntryLabel(lines),
        isScratched: lane.status === "SCRATCHED",
      };
    });
  }, [filteredLanes, laneTotals, myBets, estMultiples, marketRanks, winPoolTotal]);

  const entryLane = entryLaneId
    ? sortedLanes.find((l) => l.id === entryLaneId) ?? null
    : null;

  const openQuickEntry = useCallback((laneId: string) => {
    setEntryLaneId(laneId);
  }, []);

  const largeField = sortedLanes.length > 30;
  const statusUpper = lifecycleLabel.toUpperCase();
  const statusClass =
    status === ContestStatus.PUBLISHED
      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
      : status === ContestStatus.LOCKED
        ? "border-ft-gold/40 bg-ft-gold/10 text-ft-gold"
        : "border-white/15 bg-white/[0.06] text-neutral-200";

  return (
    <div className="space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
      {/* Compact header */}
      <header className="rounded-xl border border-white/[0.08] bg-ft-gradient-panel px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-neutral-50">
              {title}
            </h1>
            <p className="mt-1 text-[12px] text-neutral-400">
              {week != null ? `NFL Week ${week}` : null}
              {week != null && position ? " · " : null}
              {position ? position : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ShareContestButton
              contestId={contestId}
              contestTitle={title}
              className="inline-flex h-11 items-center rounded-full border border-white/10 px-3 text-xs font-medium text-neutral-300"
            />
            <Link
              href="/how-to-play"
              className="inline-flex h-11 items-center rounded-full border border-white/10 px-3 text-xs font-medium text-neutral-300"
            >
              Help
            </Link>
          </div>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-neutral-400">
          <span
            className={[
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              statusClass,
            ].join(" ")}
          >
            {statusUpper}
          </span>
          <span>·</span>
          <span className="tabular-nums">{lockLabel}</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Pool</p>
            <p className="mt-0.5 font-bold tabular-nums text-neutral-50">
              {formatCoins(totalPool)}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Entries</p>
            <p className="mt-0.5 font-bold tabular-nums text-neutral-50">{entryCount}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-1 py-2">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Remaining</p>
            <p className="mt-0.5 font-bold tabular-nums text-ft-gold">
              {isLoggedIn ? formatCoins(remainingAllocation) : "—"}
            </p>
          </div>
        </div>
      </header>

      {/* Market / Live / Results toggle */}
      {pageEmphasis === "LIVE" || pageEmphasis === "FINAL" ? (
        <div
          role="tablist"
          aria-label="Contest view"
          className="flex gap-1 rounded-full border border-white/[0.08] bg-black/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "market"}
            onClick={() => setView("market")}
            className={[
              "h-11 flex-1 rounded-full text-sm font-semibold transition",
              view === "market" ? "bg-ft-gold/15 text-ft-gold" : "text-neutral-500",
            ].join(" ")}
          >
            Market
          </button>
          {pageEmphasis === "LIVE" ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === "live"}
              onClick={() => setView("live")}
              className={[
                "h-11 flex-1 rounded-full text-sm font-semibold transition",
                view === "live" ? "bg-ft-gold/15 text-ft-gold" : "text-neutral-500",
              ].join(" ")}
            >
              Live Race
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={view === "results"}
              onClick={() => setView("results")}
              className={[
                "h-11 flex-1 rounded-full text-sm font-semibold transition",
                view === "results" ? "bg-ft-gold/15 text-ft-gold" : "text-neutral-500",
              ].join(" ")}
            >
              Results
            </button>
          )}
        </div>
      ) : null}

      {view === "live" && pageEmphasis === "LIVE" ? (
        <div className="rounded-xl border border-ft-gold/20 bg-black/20 p-1">{liveBoard}</div>
      ) : null}
      {view === "results" && pageEmphasis === "FINAL" ? (
        <div className="rounded-xl border border-ft-gold/20 bg-black/20 p-1">
          {resultsBoard ?? liveBoard}
        </div>
      ) : null}

      {(view === "market" || pageEmphasis === "PRE_RACE") && (
        <>
          {/* Sticky toolbar */}
          <div className="sticky top-[4.75rem] z-30 -mx-1 space-y-2 border-b border-white/[0.06] bg-ft-ink/95 px-1 py-2 backdrop-blur-md supports-[padding:max(0px)]:top-[max(4.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="mobile-lane-sort">
                Sort runners
              </label>
              <select
                id="mobile-lane-sort"
                value={sortKey}
                onChange={(e) => onSortKeyChange(e.target.value as LaneSortKey)}
                className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/50 px-3 text-sm text-neutral-100"
              >
                <option value="MARKET_RANK">Market Rank</option>
                <option value="PROJECTED_RANK">Projected Rank</option>
                <option value="CURRENT_ODDS">Current Odds</option>
                <option value="MOST_BACKED">Most Backed</option>
                <option value="PLAYER">A–Z</option>
              </select>
              <span className="hidden tabular-nums text-xs text-neutral-400 xs:inline">
                {formatCoins(totalPool)}
              </span>
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                className="inline-flex h-11 shrink-0 items-center rounded-full border border-ft-gold/35 bg-ft-gold/10 px-3 text-sm font-semibold text-ft-gold"
              >
                My Ticket{myTicketCount > 0 ? ` (${myTicketCount})` : ""}
              </button>
              {largeField ? (
                <button
                  type="button"
                  aria-label="Search players"
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen((v) => !v)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-300"
                >
                  ⌕
                </button>
              ) : null}
            </div>

            {searchOpen || largeField ? (
              searchOpen ? (
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search player"
                  className="h-11 w-full rounded-full border border-white/10 bg-black/50 px-4 text-base text-neutral-100 placeholder:text-neutral-600"
                />
              ) : null
            ) : null}

            {largeField ? (
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {(
                  [
                    ["ALL", "All"],
                    ...(roleFiltersAvailable.rb1 ? ([["RB1", "RB1"]] as const) : []),
                    ...(roleFiltersAvailable.rb2 ? ([["RB2", "RB2"]] as const) : []),
                    ["MY_ENTRIES", "My Entries"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={[
                      "h-9 shrink-0 rounded-full border px-3 text-xs font-semibold",
                      filter === id
                        ? "border-ft-gold/40 bg-ft-gold/10 text-ft-gold"
                        : "border-white/10 text-neutral-400",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Compact summary */}
          <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3 py-2 text-[12px] text-neutral-400">
            <div className="flex justify-between gap-2 tabular-nums">
              <span>
                Pool <span className="font-semibold text-neutral-100">{formatCoins(totalPool)}</span>
              </span>
              <span>
                Entries <span className="font-semibold text-neutral-100">{entryCount}</span>
              </span>
              <span>
                Remaining{" "}
                <span className="font-semibold text-ft-gold">
                  {isLoggedIn ? formatCoins(remainingAllocation) : "—"}
                </span>
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="truncate">
                Leader{" "}
                <span className="font-medium text-neutral-200">
                  {mostBackedName ?? "—"}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">Updated {marketUpdatedLabel}</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-600">
            Projected Rank organizes the field. Entries set live odds.
          </p>

          <div className="space-y-2">
            {runnerCards.map((runner) => (
              <MobileRunnerCard
                key={runner.id}
                runner={runner}
                onQuickEntry={openQuickEntry}
              />
            ))}
            {runnerCards.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-4 text-sm text-neutral-400">
                No runners match this filter.
              </p>
            ) : null}
          </div>

          {pageEmphasis === "PRE_RACE" ? (
            <div className="pt-1">{liveBoard}</div>
          ) : null}
        </>
      )}

      {secondaryContent ? <div className="space-y-2 pt-1">{secondaryContent}</div> : null}

      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 z-40 inline-flex h-11 items-center rounded-full border border-white/15 bg-ft-charcoal/95 px-3 text-xs font-semibold text-neutral-200 shadow-ft-card"
        >
          Top
        </button>
      ) : null}

      {/* Quick Entry sheet */}
      <MobileBottomSheet
        open={Boolean(entryLane)}
        title={entryLane ? `Quick Entry · ${entryLane.name}` : "Quick Entry"}
        onClose={() => setEntryLaneId(null)}
      >
        {entryLane ? (
          <QuickEntryPanel
            embedded
            laneId={entryLane.id}
            playerName={entryLane.name}
            currentWinOddsLabel={
              estMultiples[entryLane.id]?.WIN != null
                ? `${Number(estMultiples[entryLane.id]?.WIN).toFixed(2)}x`
                : entryLane.openingWinOddsTo1 != null
                  ? `${(entryLane.openingWinOddsTo1 + 1).toFixed(2)}x`
                  : "—"
            }
            remainingAllocation={remainingAllocation}
            existingLines={myBets
              .filter((b) => b.laneId === entryLane.id && !b.refunded)
              .map((b) => ({ market: b.market, amount: b.amount }))}
            isLoggedIn={isLoggedIn}
            bettingClosed={bettingClosed}
            canBet={canBet}
            isScratched={entryLane.status === "SCRATCHED"}
            isPending={isPending}
            poolTotals={poolTotals}
            laneTotals={
              laneTotals[entryLane.id] ?? {
                [Market.WIN]: 0,
                [Market.PLACE]: 0,
                [Market.SHOW]: 0,
              }
            }
            onClose={() => setEntryLaneId(null)}
            onSubmitSingle={async (market, amount) => {
              await onSubmitSingle(entryLane.id, market, amount, entryLane.name);
              setEntryLaneId(null);
            }}
            onSubmitWps={async (amount) => {
              await onSubmitWps(entryLane.id, amount, entryLane.name);
              setEntryLaneId(null);
            }}
          />
        ) : null}
      </MobileBottomSheet>

      {/* My Ticket sheet */}
      <MobileBottomSheet
        open={ticketOpen}
        title="My Ticket"
        onClose={() => setTicketOpen(false)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-white/[0.07] bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase text-neutral-500">Entered</p>
              <p className="font-bold tabular-nums text-neutral-50">
                {formatCoins(myEnteredTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase text-neutral-500">Remaining</p>
              <p className="font-bold tabular-nums text-ft-gold">
                {isLoggedIn ? formatCoins(remainingAllocation) : "—"}
              </p>
            </div>
          </div>

          {!isLoggedIn ? (
            <p className="text-sm text-neutral-400">
              <Link href="/auth/login" className="font-semibold text-ft-gold underline">
                Log in
              </Link>{" "}
              to track your ticket.
            </p>
          ) : myTicketCount === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-black/30 px-3 py-4 text-sm text-neutral-400">
              <p>You have not entered this race yet.</p>
              <p className="mt-1 text-xs">Enter a runner from the market list to get started.</p>
              <button
                type="button"
                onClick={() => {
                  setTicketOpen(false);
                  setView("market");
                }}
                className="ft-btn-primary mt-3 h-11 w-full text-sm font-bold"
              >
                Enter a runner
              </button>
            </div>
          ) : (
            <div className="space-y-2">{ticketSummary}</div>
          )}
        </div>
      </MobileBottomSheet>
    </div>
  );
}
