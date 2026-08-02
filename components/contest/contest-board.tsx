"use client";

import { ContestStatus, Market } from "@prisma/client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";
import { TicketDetailModal } from "@/components/tickets/ticket-detail-modal";
import { LiveRaceBoard } from "@/components/live-race-board";
import { ScoringBreakdownAccordion } from "@/components/scoring/scoring-breakdown-accordion";

import {
  MIN_BET_AMOUNT,
  MAX_BET_AMOUNT,
  REQUIRED_TOTAL_WAGER_PER_CONTEST,
  POLL_INTERVAL_MS,
} from "@/lib/constants";
import { formatCoins, formatDateTime, formatMultiple } from "@/lib/format";
import { formatContestLifecycleLabel } from "@/lib/contest-presentation";
import { formatLockCountdown } from "@/lib/contest/lock-countdown";
import {
  contestHasLiveFantasyData,
  getContestPageEmphasis,
} from "@/lib/contest/page-emphasis";
import { formatPoolShare } from "@/lib/contest/format-pool-share";
import { ShareContestButton } from "@/components/contest/share-contest-button";
import { QuickEntryPanel } from "@/components/contest/quick-entry-panel";
import { MobileContestBoard } from "@/components/contest/mobile-contest-board";
import { useHydratedMobile } from "@/lib/hooks/use-hydrated-mobile";
import type { OddsPayload } from "@/lib/market";
import { collapseWps, type BetRow } from "@/lib/wps";
import { formatSportLabel } from "@/lib/sports";
import { formatTrackConditionsLabel } from "@/lib/track-conditions";
import type { ScoringBreakdown } from "@/lib/scoring-config";

type LaneStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "SCRATCHED";

type LaneView = {
  id: string;
  name: string;
  team: string;
  position: string;
  opponent?: string | null;
  depthRole?: string | null;
  finalRank: number | null;
  openingWinOddsTo1: number | null;
  fantasyPoints: number | null;
  /** Live-only in-race fantasy points; final points remain on fantasyPoints. */
  liveFantasyPoints?: number | null;
  status: LaneStatus;
  /** Optional per-player scoring breakdown, e.g. basketball raw stats. */
  scoringBreakdown?: ScoringBreakdown | null;
  /** Display-only import seed rank / board order (does not set pool odds). */
  seedRank?: number | null;
  displayOrder?: number | null;
  projectedPoints?: number | null;
  /** Count of non-voided ticket legs on this lane. */
  entryCount?: number;
};

type ContestMeta = {
  season?: number | null;
  week?: number | null;
  slateLabel?: string | null;
  scoringLabel?: string | null;
  position?: string | null;
  headline?: string | null;
  supportingCopy?: string | null;
  runnerCount?: number;
  entryCount?: number;
  seriesName?: string | null;
};

type MyBetView = {
  id: string;
  ticketId: string | null;
  laneId: string;
  laneName: string;
  market: Market;
  amount: number;
  createdAt: string;
  refunded: boolean;
  payout?: number | null;
};

type ContestBoardProps = {
  isAdmin?: boolean;
  contestId: string;
  title: string;
  startTime: string;
  endTime: string;
  sport: string;
  trackConditions?: string | null;
  status: ContestStatus;
  lanes: LaneView[];
  initialOdds: OddsPayload;
  initialMyBets: MyBetView[];
  isLoggedIn: boolean;
  contestMeta?: ContestMeta;
  /** From live BoxScore pull (0–100). When set, progress bar uses this instead of time. */
  liveGameProgress?: number | null;
  /** From live BoxScore pull (e.g. InProgress, Final). Used for progress label when present. */
  liveGameStatus?: string | null;
  /** Right-rail modules (tape, discussion, rules). */
  children?: ReactNode;
};

type WinHeadline = {
  label: string;
  badge: "LIVE" | "OPEN" | null;
  helper: string | null;
};

type LaneSortKey =
  | "MARKET_RANK"
  | "PROJECTED_RANK"
  | "CURRENT_ODDS"
  | "MOST_BACKED"
  | "PLAYER";

/** Simple threshold: once the WIN pool has at least this much, default to market ordering. */
const MEANINGFUL_POOL_THRESHOLD = 25;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function marketBadgeClass(market: string) {
  switch (market) {
    case "WIN":
      return "border-amber-400 bg-amber-500/10 text-amber-200";
    case "PLACE":
      return "border-neutral-500 bg-neutral-900 text-neutral-100";
    case "SHOW":
      return "border-amber-300/80 bg-amber-500/5 text-amber-100";
    default:
      return "border-neutral-700 bg-neutral-900 text-neutral-200";
  }
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getSortablePlayerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim().toLowerCase();

  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join(" ");
  return `${lastName} ${firstNames}`.toLowerCase();
}

const MAX_WPS_BET_AMOUNT = 30;
const markets: Market[] = [Market.WIN, Market.PLACE, Market.SHOW];

function formatLaneDisplayName(
  name: string,
  position?: string | null,
  team?: string | null
): string {
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
        <span className="rounded-full border border-yellow-400/70 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-medium text-yellow-200">
          Questionable
        </span>
      );
    case "DOUBTFUL":
      return (
        <span className="rounded-full border border-orange-400/80 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200">
          Doubtful
        </span>
      );
    case "SCRATCHED":
      return (
        <span className="rounded-full border border-red-500/80 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">
          Scratched
        </span>
      );
    default:
      return null;
  }
}

function getWinHeadline(
  liveWinMultiple: number | null,
  openingWinOddsTo1: number | null
): WinHeadline {
  if (liveWinMultiple !== null) {
    const oddsTo1 = Math.max(liveWinMultiple - 1, 0);
    return {
      label: oddsTo1 < 1 ? `${liveWinMultiple.toFixed(2)}x` : `${oddsTo1.toFixed(0)}-1`,
      badge: "LIVE",
      helper: null,
    };
  }

  if (openingWinOddsTo1 != null) {
    return {
      label: `${openingWinOddsTo1.toFixed(0)}-1`,
      badge: "OPEN",
      helper: "No WIN bets in this pool yet — your wager will move this number.",
    };
  }

  return {
    label: "Pool odds not established",
    badge: null,
    helper: "Odds appear after the first valid entries.",
  };
}

function formatProjectedPoints(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return value.toFixed(1).replace(/\.0$/, "");
}

function poolHasEntries(odds: OddsPayload): boolean {
  const totals = odds.poolTotals;
  return (totals.WIN ?? 0) + (totals.PLACE ?? 0) + (totals.SHOW ?? 0) > 0;
}

function laneMatchupLine(lane: Pick<LaneView, "team" | "opponent" | "depthRole">): string | null {
  const parts: string[] = [];
  if (lane.team) {
    parts.push(lane.opponent ? `${lane.team} vs ${lane.opponent}` : lane.team);
  } else if (lane.opponent) {
    parts.push(`vs ${lane.opponent}`);
  }
  if (lane.depthRole) parts.push(lane.depthRole);
  return parts.length ? parts.join(" · ") : null;
}

function OddsMoveInfoPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Why did odds move?"
        aria-expanded={open}
        className="rounded border border-white/15 px-1.5 py-0 text-xs text-neutral-500 transition hover:border-ft-gold/40 hover:text-ft-gold"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        ⓘ
      </button>

      {open && (
        <div
          role="tooltip"
          aria-label="Why do odds move?"
          className="absolute left-0 top-6 z-30 w-72 rounded-ft border border-white/10 bg-ft-charcoal/98 p-3 text-xs text-neutral-300 shadow-ft-card backdrop-blur-md"
        >
          <p className="font-semibold text-ft-gold">Why do odds move?</p>
          <p className="mt-1.5 leading-relaxed text-neutral-400">
            FantasyTrack uses a pool (parimutuel) system. As more money is wagered on a lane, its
            estimated payout decreases, and other lanes&apos; payouts increase.
          </p>
          <p className="mt-2 text-[11px] text-neutral-500">
            Estimates update as others wager and final payouts are set at lock/settlement.
          </p>
        </div>
      )}
    </span>
  );
}

function TicketCard({
  title,
  subtitle,
  right,
  body,
}: {
  title: string;
  subtitle: ReactNode;
  right: string;
  body?: string;
}) {
  return (
    <div className="rounded-ft border border-white/[0.07] bg-black/35 p-3 shadow-ft-card transition hover:border-white/12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-neutral-100">{title}</div>
          <div className="text-xs text-neutral-500">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums text-neutral-50">{right}</div>
        </div>
      </div>
      {body ? <div className="mt-2 text-xs text-neutral-500">{body}</div> : null}
    </div>
  );
}

export default function ContestBoard({
  contestId,
  title,
  startTime,
  endTime,
  sport,
  trackConditions,
  status,
  lanes,
  initialOdds,
  initialMyBets,
  isLoggedIn,
  contestMeta,
  liveGameProgress,
  liveGameStatus,
  children,
}: ContestBoardProps) {
  const [selectedMarket, setSelectedMarket] = useState<Market>(Market.WIN);
  const [selectedLaneId, setSelectedLaneId] = useState<string>(
    lanes.find((lane) => lane.status !== "SCRATCHED")?.id ?? lanes[0]?.id ?? ""
  );
  const [singleAmount, setSingleAmount] = useState<string>(String(MIN_BET_AMOUNT));
  const [wpsAmount, setWpsAmount] = useState<string>(String(MIN_BET_AMOUNT));
  const [odds, setOdds] = useState<OddsPayload>(initialOdds);
  const [myBets, setMyBets] = useState<MyBetView[]>(initialMyBets);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [sortKey, setSortKey] = useState<LaneSortKey>(() => {
    const winPool = initialOdds.poolTotals.WIN ?? 0;
    if (winPool >= MEANINGFUL_POOL_THRESHOLD) return "MARKET_RANK";
    if (lanes.some((l) => l.displayOrder != null || l.seedRank != null)) return "PROJECTED_RANK";
    return "CURRENT_ODDS";
  });
  const [isPending, startTransition] = useTransition();

  const [ticketOpen, setTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  // Inline slip opened under a specific odds row
  const [inlineSlipLaneId, setInlineSlipLaneId] = useState<string | null>(null);
  const [openScoringLaneId, setOpenScoringLaneId] = useState<string | null>(null);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<Date>(() => new Date());
  const [liveBoardExpanded, setLiveBoardExpanded] = useState(false);
  const layoutViewport = useHydratedMobile(768);

  const myBetsScrollRef = useRef<HTMLDivElement | null>(null);

  const collapsedMyBets = useMemo(() => {
    const rows: BetRow[] = myBets.map((b) => ({
      id: b.id,
      ticketId: b.ticketId ?? null,
      laneId: b.laneId,
      laneName: b.laneName,
      market: b.market,
      amount: b.amount,
      createdAt: b.createdAt,
    }));

    const collapsed = collapseWps(rows);

    collapsed.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return collapsed;
  }, [myBets]);

  const laneTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of myBets) {
      m.set(b.laneId, (m.get(b.laneId) ?? 0) + b.amount);
    }
    return m;
  }, [myBets]);

  const ticketsByLane = useMemo(() => {
    const map = new Map<string, { laneId: string; laneName: string; lines: any[] }>();

    for (const line of collapsedMyBets as any[]) {
      const laneId = line.laneId as string;
      const laneName = line.laneName as string;

      const existing = map.get(laneId);
      if (!existing) {
        map.set(laneId, { laneId, laneName, lines: [line] });
      } else {
        existing.lines.push(line);
      }
    }

    const groups = Array.from(map.values()).sort((a, b) => {
      const ta = laneTotals.get(a.laneId) ?? 0;
      const tb = laneTotals.get(b.laneId) ?? 0;
      if (tb !== ta) return tb - ta;
      return a.laneName.localeCompare(b.laneName);
    });

    for (const g of groups) {
      g.lines.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    }

    return groups;
  }, [collapsedMyBets, laneTotals]);

  /** Lanes where the user has any active (non-refunded) wager — for neutral leaderboard highlight. */
  const userPickLaneIds = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const b of myBets) {
      if (!b.refunded) out[b.laneId] = true;
    }
    return out;
  }, [myBets]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (myBetsScrollRef.current) myBetsScrollRef.current.scrollTop = 0;
    });
  }, [myBets.length]);

  const laneById = useMemo(() => {
    const map = new Map<string, LaneView>();
    for (const lane of lanes) map.set(lane.id, lane);
    return map;
  }, [lanes]);

  const hasPoolEntries = useMemo(() => poolHasEntries(odds), [odds]);
  const winPoolTotal = odds.poolTotals.WIN ?? 0;

  const marketRanks = useMemo(() => {
    const ranked = [...lanes].sort((a, b) => {
      const aAmt = odds.laneTotals[a.id]?.WIN ?? 0;
      const bAmt = odds.laneTotals[b.id]?.WIN ?? 0;
      if (aAmt !== bAmt) return bAmt - aAmt;
      const aM = odds.estMultiples[a.id]?.WIN ?? 9999;
      const bM = odds.estMultiples[b.id]?.WIN ?? 9999;
      if (aM !== bM) return aM - bM;
      return compareStrings(getSortablePlayerName(a.name), getSortablePlayerName(b.name));
    });
    const map = new Map<string, number>();
    ranked.forEach((lane, index) => map.set(lane.id, index + 1));
    return map;
  }, [lanes, odds]);

  const sortedLanes = useMemo(() => {
    const copy = [...lanes];

    copy.sort((a, b) => {
      if (sortKey === "PLAYER") {
        return compareStrings(getSortablePlayerName(a.name), getSortablePlayerName(b.name));
      }

      if (sortKey === "PROJECTED_RANK") {
        const aOrder = a.seedRank ?? a.displayOrder ?? 9999;
        const bOrder = b.seedRank ?? b.displayOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return compareStrings(getSortablePlayerName(a.name), getSortablePlayerName(b.name));
      }

      if (sortKey === "MOST_BACKED" || sortKey === "MARKET_RANK") {
        const aAmt = odds.laneTotals[a.id]?.WIN ?? 0;
        const bAmt = odds.laneTotals[b.id]?.WIN ?? 0;
        if (aAmt !== bAmt) return bAmt - aAmt;
        const aM = odds.estMultiples[a.id]?.WIN ?? 9999;
        const bM = odds.estMultiples[b.id]?.WIN ?? 9999;
        if (aM !== bM) return aM - bM;
        // Empty pool: keep projected order stable.
        if (aAmt === 0 && bAmt === 0) {
          const aOrder = a.seedRank ?? a.displayOrder ?? 9999;
          const bOrder = b.seedRank ?? b.displayOrder ?? 9999;
          if (aOrder !== bOrder) return aOrder - bOrder;
        }
        return compareStrings(getSortablePlayerName(a.name), getSortablePlayerName(b.name));
      }

      // CURRENT_ODDS — shortest live multiple first; empty falls back to projected.
      const aWinMultiple =
        odds.estMultiples[a.id]?.WIN ??
        (a.openingWinOddsTo1 != null ? a.openingWinOddsTo1 + 1 : 9999);
      const bWinMultiple =
        odds.estMultiples[b.id]?.WIN ??
        (b.openingWinOddsTo1 != null ? b.openingWinOddsTo1 + 1 : 9999);

      if (aWinMultiple === 9999 && bWinMultiple === 9999) {
        const aOrder = a.seedRank ?? a.displayOrder ?? 9999;
        const bOrder = b.seedRank ?? b.displayOrder ?? 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }

      if (aWinMultiple !== bWinMultiple) return aWinMultiple - bWinMultiple;

      return compareStrings(
        formatLaneDisplayName(a.name, a.position, a.team),
        formatLaneDisplayName(b.name, b.position, b.team)
      );
    });

    return copy;
  }, [lanes, sortKey, odds]);

  const selectedLane = useMemo(
    () => lanes.find((lane) => lane.id === selectedLaneId) ?? null,
    [lanes, selectedLaneId]
  );

  const selectedLaneIsScratched = selectedLane?.status === "SCRATCHED";

  useEffect(() => {
    const current = lanes.find((lane) => lane.id === selectedLaneId);
    if (current && current.status !== "SCRATCHED") return;

    const firstActiveLane = lanes.find((lane) => lane.status !== "SCRATCHED");
    if (firstActiveLane) setSelectedLaneId(firstActiveLane.id);
  }, [lanes, selectedLaneId]);

  const bettingClosed = status === ContestStatus.LOCKED || status === ContestStatus.SETTLED;

  const canBetByStatus =
    !bettingClosed && odds.status === ContestStatus.PUBLISHED && odds.timeToLockSeconds > 0;
  const isMaxedOut = isLoggedIn && odds.myCoinsRemainingInContest < MIN_BET_AMOUNT;

  const disableAllBetActions =
    bettingClosed || !isLoggedIn || !canBetByStatus || isMaxedOut || selectedLaneIsScratched;

  const parsedSingleAmount = Number(singleAmount);
  const parsedWpsAmount = Number(wpsAmount);

  const singleTooSmall =
    Number.isFinite(parsedSingleAmount) &&
    parsedSingleAmount > 0 &&
    parsedSingleAmount < MIN_BET_AMOUNT;
  const wpsTooSmall =
    Number.isFinite(parsedWpsAmount) && parsedWpsAmount > 0 && parsedWpsAmount < MIN_BET_AMOUNT;

  const singleNotIncrement =
    Number.isFinite(parsedSingleAmount) && parsedSingleAmount > 0 && parsedSingleAmount % 5 !== 0;
  const wpsNotIncrement =
    Number.isFinite(parsedWpsAmount) && parsedWpsAmount > 0 && parsedWpsAmount % 5 !== 0;

  const singleTooLarge = Number.isFinite(parsedSingleAmount) && parsedSingleAmount > MAX_BET_AMOUNT;
  const wpsTooLarge = Number.isFinite(parsedWpsAmount) && parsedWpsAmount > MAX_WPS_BET_AMOUNT;

  const singleValid =
    Number.isInteger(parsedSingleAmount) &&
    parsedSingleAmount >= MIN_BET_AMOUNT &&
    parsedSingleAmount <= MAX_BET_AMOUNT &&
    parsedSingleAmount % 5 === 0;

  const wpsValid =
    Number.isInteger(parsedWpsAmount) &&
    parsedWpsAmount >= MIN_BET_AMOUNT &&
    parsedWpsAmount <= MAX_WPS_BET_AMOUNT &&
    parsedWpsAmount % 5 === 0;

  function getProjectedWinMultiple(amount: number): number | null {
    if (!selectedLaneId || amount <= 0 || !Number.isFinite(amount) || selectedLaneIsScratched) {
      return null;
    }

    const poolWin = odds.poolTotals.WIN;
    const laneWin = odds.laneTotals[selectedLaneId]?.WIN ?? 0;
    const poolWinAfter = poolWin + amount;
    const laneWinAfter = laneWin + amount;

    return laneWinAfter > 0 ? poolWinAfter / laneWinAfter : null;
  }

  const projectedSingleWinMultiple =
    selectedMarket === Market.WIN && singleValid ? getProjectedWinMultiple(parsedSingleAmount) : null;

  const projectedWpsWinMultiple = wpsValid ? getProjectedWinMultiple(parsedWpsAmount) : null;

  const selectedRunnerLabel = selectedLane
    ? formatLaneDisplayName(selectedLane.name, selectedLane.position, selectedLane.team)
    : "—";

  /** Display-only: current WIN line for the slip header (same rules as odds table). */
  const slipWinHeadline = useMemo(() => {
    if (!selectedLane) return null;
    const winMultiple = odds.estMultiples[selectedLaneId]?.WIN ?? null;
    return getWinHeadline(winMultiple, selectedLane.openingWinOddsTo1);
  }, [selectedLane, selectedLaneId, odds]);

  const coinsUsedInContest = REQUIRED_TOTAL_WAGER_PER_CONTEST - odds.myCoinsRemainingInContest;
  const allocationProgress = Math.max(
    0,
    Math.min(100, (coinsUsedInContest / REQUIRED_TOTAL_WAGER_PER_CONTEST) * 100)
  );

  function closeQuickEntry(returnFocusLaneId?: string | null) {
    const laneToFocus = returnFocusLaneId ?? inlineSlipLaneId;
    setInlineSlipLaneId(null);
    if (laneToFocus) {
      requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(`[data-lane-row="${laneToFocus}"]`);
        row?.focus();
      });
    }
  }

  function renderQuickEntry(lane: LaneView, playerLabel: string, headline: WinHeadline) {
    const existingLines = myBets
      .filter((b) => b.laneId === lane.id && !b.refunded)
      .map((b) => ({ market: b.market, amount: b.amount }));
    const lanePool = odds.laneTotals[lane.id] ?? {
      [Market.WIN]: 0,
      [Market.PLACE]: 0,
      [Market.SHOW]: 0,
    };

    return (
      <QuickEntryPanel
        laneId={lane.id}
        playerName={playerLabel}
        currentWinOddsLabel={headline.label}
        remainingAllocation={odds.myCoinsRemainingInContest}
        existingLines={existingLines}
        isLoggedIn={isLoggedIn}
        bettingClosed={bettingClosed}
        canBet={canBetByStatus}
        isScratched={lane.status === "SCRATCHED"}
        isPending={isPending}
        poolTotals={odds.poolTotals}
        laneTotals={lanePool}
        onClose={() => closeQuickEntry(lane.id)}
        onSubmitSingle={async (market, amount) => {
          setSelectedLaneId(lane.id);
          setSelectedMarket(market);
          setSingleAmount(String(amount));
          await placeSingleBet({
            laneId: lane.id,
            market,
            amount,
            fromQuickEntry: true,
            playerName: playerLabel,
          });
        }}
        onSubmitWps={async (amount) => {
          setSelectedLaneId(lane.id);
          setWpsAmount(String(amount));
          await placeWpsBet({
            laneId: lane.id,
            amount,
            fromQuickEntry: true,
            playerName: playerLabel,
          });
        }}
      />
    );
  }

  async function refreshOdds() {
    const res = await fetch(`/api/contest/${contestId}/odds`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok) {
      const payload = (await res.json()) as OddsPayload;
      setOdds(payload);
      setMarketUpdatedAt(new Date());
    }
  }

  /**
   * Polling ownership (single loops — do not add duplicates in mobile/desktop shells):
   * - Odds: this ContestBoard effect only (POLL_INTERVAL_MS)
   * - Live tape: ContestLiveTape (mounted once via ContestSecondaryPanels)
   * - Live race board: no network poll (props from parent / lane fantasy points)
   * - Quick Entry / My Ticket: reuse parent odds state; no extra fetches on open
   */
  useEffect(() => {
    if (bettingClosed) return;

    const timer = setInterval(() => {
      void refreshOdds();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: poll depends only on contestId/bettingClosed; refreshOdds is not stable
  }, [contestId, bettingClosed]);

  async function placeSingleBet(opts?: {
    laneId?: string;
    market?: Market;
    amount?: number;
    fromQuickEntry?: boolean;
    playerName?: string;
  }) {
    setError("");
    setMessage("");

    const laneId = opts?.laneId ?? selectedLaneId;
    const market = opts?.market ?? selectedMarket;
    const amount = opts?.amount ?? parsedSingleAmount;
    const lane = laneById.get(laneId);
    const laneScratched = lane?.status === "SCRATCHED";
    const playerName = opts?.playerName ?? lane?.name ?? "runner";

    if (laneScratched) {
      setError("Scratched runners cannot accept new entries.");
      return;
    }

    if (bettingClosed) {
      setError("Entries are closed for this race.");
      return;
    }

    if (!isLoggedIn || !canBetByStatus) return;

    if (!Number.isInteger(amount) || amount < MIN_BET_AMOUNT) {
      setError(`Minimum entry is ${formatCoins(MIN_BET_AMOUNT)}.`);
      return;
    }

    if (amount % 5 !== 0) {
      setError("Entries must be in increments of $5.");
      return;
    }

    if (amount > MAX_BET_AMOUNT) {
      setError(`Maximum single entry is ${formatCoins(MAX_BET_AMOUNT)}.`);
      return;
    }

    if (odds.myCoinsRemainingInContest < amount) {
      setError("This entry exceeds your remaining contest allocation.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contest/${contestId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId,
          market,
          amount,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        createdBets?: Array<{
          id: string;
          ticketId: string | null;
          laneId: string;
          market: Market;
          amount: number;
          createdAt: string;
        }>;
        odds?: OddsPayload;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to add entry.");
        return;
      }

      if (payload.odds) {
        setOdds(payload.odds);
        setMarketUpdatedAt(new Date());
      } else await refreshOdds();

      if (payload.createdBets?.length) {
        const newRows: MyBetView[] = payload.createdBets.map((bet) => ({
          id: bet.id,
          ticketId: bet.ticketId ?? null,
          laneId: bet.laneId,
          laneName: laneById.get(bet.laneId)?.name ?? "Lane",
          market: bet.market,
          amount: bet.amount,
          createdAt: bet.createdAt,
          refunded: laneById.get(bet.laneId)?.status === "SCRATCHED",
          payout: null,
        }));
        setMyBets((prev) => [...newRows, ...prev]);
      }

      if (opts?.fromQuickEntry) {
        setInlineSlipLaneId(null);
        setMessage(`${market} entry added for ${playerName}`);
      } else {
        setMessage(`${market} entry added for ${playerName}`);
      }
    });
  }

  async function placeWpsBet(opts?: {
    laneId?: string;
    amount?: number;
    fromQuickEntry?: boolean;
    playerName?: string;
  }) {
    setError("");
    setMessage("");

    const laneId = opts?.laneId ?? selectedLaneId;
    const amount = opts?.amount ?? parsedWpsAmount;
    const lane = laneById.get(laneId);
    const laneScratched = lane?.status === "SCRATCHED";
    const playerName = opts?.playerName ?? lane?.name ?? "runner";

    if (laneScratched) {
      setError("Scratched runners cannot accept new entries.");
      return;
    }

    if (bettingClosed) {
      setError("Entries are closed for this race.");
      return;
    }

    if (!isLoggedIn || !canBetByStatus) return;

    if (!Number.isInteger(amount) || amount < MIN_BET_AMOUNT) {
      setError(`Minimum WPS amount is ${formatCoins(MIN_BET_AMOUNT)} per pool.`);
      return;
    }

    if (amount % 5 !== 0) {
      setError("WPS amounts must be in increments of $5.");
      return;
    }

    if (amount > MAX_WPS_BET_AMOUNT) {
      setError(`Maximum WPS amount is ${formatCoins(MAX_WPS_BET_AMOUNT)} per pool.`);
      return;
    }

    const totalCost = amount * 3;
    if (odds.myCoinsRemainingInContest < totalCost) {
      setError("WPS total exceeds your remaining contest allocation.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contest/${contestId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId,
          action: "WPS",
          amount,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        createdBets?: Array<{
          id: string;
          ticketId: string | null;
          laneId: string;
          market: Market;
          amount: number;
          createdAt: string;
        }>;
        odds?: OddsPayload;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to add WPS entry.");
        return;
      }

      if (payload.odds) {
        setOdds(payload.odds);
        setMarketUpdatedAt(new Date());
      } else await refreshOdds();

      if (payload.createdBets?.length) {
        const newRows: MyBetView[] = payload.createdBets.map((bet) => ({
          id: bet.id,
          ticketId: bet.ticketId ?? null,
          laneId: bet.laneId,
          laneName: laneById.get(bet.laneId)?.name ?? "Lane",
          market: bet.market,
          amount: bet.amount,
          createdAt: bet.createdAt,
          refunded: laneById.get(bet.laneId)?.status === "SCRATCHED",
          payout: null,
        }));
        setMyBets((prev) => [...newRows, ...prev]);
      }

      if (opts?.fromQuickEntry) {
        setInlineSlipLaneId(null);
      }
      setMessage(`WPS entry added for ${playerName}`);
    });
  }

  const sportLabel = formatSportLabel(sport as any);
  const trackConditionsLabel = formatTrackConditionsLabel(trackConditions);
  const displayHeadline = contestMeta?.headline?.trim() || title;
  const lifecycleLabel = formatContestLifecycleLabel(status);
  const lifecycleUpper = lifecycleLabel.toUpperCase();
  const runnerCount = contestMeta?.runnerCount ?? lanes.length;
  const boardEntryCount = contestMeta?.entryCount ?? 0;
  const totalPoolAmount =
    (odds.poolTotals.WIN ?? 0) + (odds.poolTotals.PLACE ?? 0) + (odds.poolTotals.SHOW ?? 0);
  const hasLiveFantasy = contestHasLiveFantasyData(lanes);
  const pageEmphasis = getContestPageEmphasis({
    status,
    hasLiveFantasyData: hasLiveFantasy,
    liveGameStatus,
  });
  const lockCountdownLabel = formatLockCountdown(
    odds.timeToLockSeconds,
    new Date(startTime),
    (d) => formatDateTime(d).replace(", ", " at ")
  );
  const mostBackedLane = (() => {
    let best: LaneView | null = null;
    let bestAmt = -1;
    for (const lane of lanes) {
      const amt = odds.laneTotals[lane.id]?.WIN ?? 0;
      if (amt > bestAmt) {
        bestAmt = amt;
        best = lane;
      }
    }
    return bestAmt > 0 ? best : null;
  })();
  const marketUpdatedLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(marketUpdatedAt);
  const statusPillClass =
    status === ContestStatus.PUBLISHED
      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
      : status === ContestStatus.LOCKED
        ? "border-ft-gold/40 bg-ft-gold/10 text-ft-gold"
        : status === ContestStatus.SETTLED
          ? "border-white/15 bg-white/[0.06] text-neutral-200"
          : "border-neutral-600/70 bg-neutral-900/80 text-neutral-200";

  const liveBoardNode = (
    <LiveRaceBoard
      contestId={contestId}
      title={title}
      sport={sport}
      startTime={startTime}
      endTime={endTime}
      lanes={lanes.map((lane) => ({
        id: lane.id,
        name: lane.name,
        team: lane.team ?? null,
        position: lane.position ?? null,
        fantasyPoints: lane.liveFantasyPoints ?? lane.fantasyPoints ?? null,
        status: lane.status,
      }))}
      userPickLaneIds={isLoggedIn ? userPickLaneIds : undefined}
      liveGameProgress={liveGameProgress ?? undefined}
      liveGameStatus={liveGameStatus ?? undefined}
      presentation={pageEmphasis === "PRE_RACE" ? "compact" : "full"}
      expanded={liveBoardExpanded}
      onExpandedChange={setLiveBoardExpanded}
    />
  );

  const enterRaceRail = (
    <div className="rounded-ft-lg border border-ft-gold/30 bg-gradient-to-b from-ft-gold/[0.08] to-black/40 p-4 shadow-ft-card">
      {!isLoggedIn ? (
        <>
          <p className="text-sm font-bold text-neutral-50">Enter Race</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            Free-play Win / Place / Show pools. Log in to stake your weekly allocation.
          </p>
          <Link
            href="/auth/login"
            className="ft-btn-primary mt-3 flex w-full items-center justify-center px-4 py-2.5 text-sm font-bold"
          >
            Log in to enter
          </Link>
        </>
      ) : myBets.length > 0 ? (
        <>
          <p className="text-sm font-bold text-neutral-50">Your ticket</p>
          <p className="mt-1 text-xs text-neutral-400">
            Entered {formatCoins(coinsUsedInContest)} ·{" "}
            <span className="text-ft-gold tabular-nums">
              {formatCoins(odds.myCoinsRemainingInContest)} remaining
            </span>
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-neutral-300">
            {ticketsByLane.slice(0, 4).map((g) => (
              <li key={g.laneId} className="flex justify-between gap-2">
                <span className="truncate">{g.laneName}</span>
                <span className="shrink-0 tabular-nums text-neutral-100">
                  {formatCoins(laneTotals.get(g.laneId) ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <a
            href="#bet-slip"
            className="mt-3 inline-flex text-xs font-semibold text-ft-gold hover:underline"
          >
            {bettingClosed ? "Review ticket" : "Add or edit entries"}
          </a>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-neutral-50">Enter Race</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            Win / Place / Show — pool odds move with free-play entries until lock.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Remaining allocation{" "}
            <span className="font-semibold tabular-nums text-ft-gold">
              {formatCoins(odds.myCoinsRemainingInContest)}
            </span>
          </p>
          <a
            href="#bet-slip"
            className="ft-btn-primary mt-3 flex w-full items-center justify-center px-4 py-2.5 text-sm font-bold"
          >
            {bettingClosed ? "Entries closed" : "Enter Race"}
          </a>
        </>
      )}
    </div>
  );

  const ticketSummaryForMobile = (
    <div className="space-y-2">
      {ticketsByLane.map((group) => (
        <div
          key={group.laneId}
          className="rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-neutral-100">{group.laneName}</p>
            <p className="shrink-0 text-sm font-bold tabular-nums text-ft-gold">
              {formatCoins(laneTotals.get(group.laneId) ?? 0)}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {group.lines.length} line{group.lines.length === 1 ? "" : "s"}
          </p>
        </div>
      ))}
      <p className="text-[12px] text-neutral-500">
        Tap Quick Entry on a runner to add another entry.
      </p>
    </div>
  );

  const settledResultsBoard =
    status === ContestStatus.SETTLED ? (
      <div className="space-y-2 p-2">
        {lanes
          .filter((lane) => lane.finalRank !== null)
          .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999))
          .slice(0, 12)
          .map((lane) => (
            <div
              key={lane.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2"
            >
              <span className="text-sm font-semibold text-neutral-100">
                #{lane.finalRank} {lane.name}
              </span>
              <span className="text-sm tabular-nums text-neutral-300">
                {lane.fantasyPoints ?? "—"}
              </span>
            </div>
          ))}
      </div>
    ) : undefined;

  /*
   * Layout strategy (hydration-safe):
   * 1) Neutral shell until viewport is known — never flash the desktop table on phones.
   * 2) Then mount ONLY the mobile or desktop market branch.
   * 3) Secondary panels (children) always mount once in the aside.
   */
  const marketBranch = !layoutViewport.ready ? (
    <div className="min-w-0 space-y-3" aria-busy="true" aria-label="Loading race board">
      <section className="rounded-xl border border-white/[0.08] bg-ft-gradient-panel px-3 py-3 sm:px-5 sm:py-4">
        <h1 className="text-lg font-bold tracking-tight text-neutral-50 sm:text-2xl">
          {displayHeadline}
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          <span className="font-semibold uppercase tracking-wide text-neutral-300">
            {lifecycleUpper}
          </span>
          {" · "}
          {bettingClosed ? "Entries closed" : lockCountdownLabel}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-2 py-2">
            <p className="text-[10px] uppercase text-neutral-500">Pool</p>
            <p className="mt-0.5 font-bold tabular-nums text-neutral-50">
              {formatCoins(totalPoolAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-2 py-2">
            <p className="text-[10px] uppercase text-neutral-500">Entries</p>
            <p className="mt-0.5 font-bold tabular-nums text-neutral-50">{boardEntryCount}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/35 px-2 py-2">
            <p className="text-[10px] uppercase text-neutral-500">Runners</p>
            <p className="mt-0.5 font-bold tabular-nums text-neutral-50">{runnerCount}</p>
          </div>
        </div>
      </section>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[5.5rem] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  ) : layoutViewport.isMobile ? (
    <div className="min-w-0">
      {(message || error) && (
        <div className="mb-3 space-y-2">
          {message ? (
            <p
              role="status"
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200"
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-300"
            >
              {error}
            </p>
          ) : null}
        </div>
      )}
      <MobileContestBoard
        contestId={contestId}
        title={displayHeadline}
        status={status}
        lifecycleLabel={lifecycleLabel}
        lockLabel={bettingClosed ? "Entries closed" : lockCountdownLabel}
        week={contestMeta?.week}
        position={contestMeta?.position}
        totalPool={totalPoolAmount}
        entryCount={boardEntryCount}
        remainingAllocation={odds.myCoinsRemainingInContest}
        isLoggedIn={isLoggedIn}
        bettingClosed={bettingClosed}
        canBet={canBetByStatus}
        isPending={isPending}
        pageEmphasis={pageEmphasis}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortedLanes={sortedLanes}
        marketRanks={marketRanks}
        poolTotals={odds.poolTotals}
        laneTotals={odds.laneTotals}
        estMultiples={odds.estMultiples}
        winPoolTotal={winPoolTotal}
        myBets={myBets}
        mostBackedName={mostBackedLane?.name ?? null}
        marketUpdatedLabel={marketUpdatedLabel}
        liveBoard={liveBoardNode}
        resultsBoard={settledResultsBoard}
        secondaryContent={null}
        ticketSummary={ticketSummaryForMobile}
        onSubmitSingle={async (laneId, market, amount, playerName) => {
          setSelectedLaneId(laneId);
          setSelectedMarket(market);
          setSingleAmount(String(amount));
          await placeSingleBet({
            laneId,
            market,
            amount,
            fromQuickEntry: true,
            playerName,
          });
        }}
        onSubmitWps={async (laneId, amount, playerName) => {
          setSelectedLaneId(laneId);
          setWpsAmount(String(amount));
          await placeWpsBet({
            laneId,
            amount,
            fromQuickEntry: true,
            playerName,
          });
        }}
      />
    </div>
  ) : (
    <div className="min-w-0 space-y-4">
        <section className="relative overflow-hidden rounded-ft-lg border border-white/[0.07] bg-ft-gradient-panel px-4 py-3.5 shadow-ft-card sm:px-5 sm:py-4">
          <div className="pointer-events-none absolute inset-0 bg-ft-radial-gold opacity-70" />
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-neutral-400">
              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  statusPillClass,
                ].join(" ")}
              >
                {lifecycleUpper}
              </span>
              <span className="hidden text-neutral-600 sm:inline">·</span>
              <span>
                {bettingClosed
                  ? "Entries closed"
                  : `Entries accepted until ${formatDateTime(new Date(startTime))}`}
              </span>
              {contestMeta?.seriesName ? (
                <>
                  <span className="hidden text-neutral-600 sm:inline">·</span>
                  <span className="text-neutral-500">
                    Counts toward{" "}
                    <span className="font-medium text-neutral-300">{contestMeta.seriesName}</span>
                  </span>
                </>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">
                  {displayHeadline}
                </h1>
                {contestMeta?.supportingCopy ? (
                  <p className="max-w-xl text-sm leading-snug text-neutral-300">
                    {contestMeta.supportingCopy}
                  </p>
                ) : null}
                <p className="text-xs text-neutral-500">
                  Rankings organize the field; the pool sets the odds.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {contestMeta?.week != null ? (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                      NFL Week {contestMeta.week}
                    </span>
                  ) : (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                      {sportLabel}
                    </span>
                  )}
                  {contestMeta?.position ? (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                      {contestMeta.position}
                    </span>
                  ) : null}
                  {contestMeta?.scoringLabel ? (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {contestMeta.scoringLabel}
                    </span>
                  ) : null}
                  {contestMeta?.slateLabel ? (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {contestMeta.slateLabel.replace(/ games$/i, "")}
                    </span>
                  ) : trackConditionsLabel ? (
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {trackConditionsLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-stretch lg:flex-col lg:items-end">
                <div className="grid grid-cols-3 gap-2 sm:min-w-[17rem]">
                  <div className="rounded border border-white/[0.08] bg-black/35 px-2.5 py-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                      Pool
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-50">
                      {formatCoins(totalPoolAmount)}
                    </p>
                  </div>
                  <div className="rounded border border-white/[0.08] bg-black/35 px-2.5 py-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                      Entries
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-50">
                      {boardEntryCount}
                    </p>
                  </div>
                  <div className="rounded border border-white/[0.08] bg-black/35 px-2.5 py-2 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                      Runners
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-50">
                      {runnerCount}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <ShareContestButton
                    contestId={contestId}
                    contestTitle={displayHeadline}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition hover:border-ft-gold/35 hover:text-ft-gold"
                  />
                  <Link
                    href="/how-to-play"
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition hover:border-ft-gold/35 hover:text-ft-gold"
                  >
                    How to Play
                  </Link>
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                      bettingClosed
                        ? "border-white/10 text-neutral-500"
                        : "border-ft-gold/30 bg-ft-gold/5 text-ft-gold",
                    ].join(" ")}
                  >
                    {bettingClosed ? "Entries closed" : lockCountdownLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {pageEmphasis === "LIVE" || pageEmphasis === "FINAL" ? (
          <div className="relative rounded-ft-lg border border-ft-gold/20 bg-black/20 p-1 sm:p-1.5">
            {liveBoardNode}
          </div>
        ) : null}

        {bettingClosed && pageEmphasis === "PRE_RACE" ? (
          <div className="rounded-ft border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-400">
            Betting is closed — this race no longer accepts entries.
          </div>
        ) : null}

        {message ? (
          <p
            role="status"
            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200"
          >
            {message}
          </p>
        ) : null}
        {error && inlineSlipLaneId ? (
          <p
            role="alert"
            className="rounded border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div
          id="odds-board"
          className="sticky top-[4.5rem] z-20 -mx-1 space-y-2 border-b border-white/[0.06] bg-ft-ink/95 px-1 py-2 backdrop-blur-md sm:top-20"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-base font-bold tracking-tight text-neutral-50">Odds &amp; pools</p>
              <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-neutral-500">
                Projected Rank organizes the field. Participant entries determine live odds and
                Market Rank.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="hidden tabular-nums text-neutral-500 sm:inline">
                Pool {formatCoins(totalPoolAmount)}
              </span>
              <label htmlFor="lane-sort" className="text-neutral-500">
                Sort
              </label>
              <select
                id="lane-sort"
                value={sortKey}
                onChange={(event) => {
                  const nextSort = event.target.value as LaneSortKey;
                  setSortKey(nextSort);
                }}
                className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-neutral-100 transition hover:border-ft-gold/30"
              >
                <option value="MARKET_RANK">Market Rank</option>
                <option value="PROJECTED_RANK">Projected Rank</option>
                <option value="CURRENT_ODDS">Current Odds</option>
                <option value="MOST_BACKED">Most Backed</option>
                <option value="PLAYER">Player A-Z</option>
              </select>
              {!bettingClosed ? (
                <a
                  href="#bet-slip"
                  className="rounded-full border border-ft-gold/35 bg-ft-gold/10 px-2.5 py-1 text-[11px] font-semibold text-ft-gold transition hover:bg-ft-gold/15"
                >
                  Enter
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded border border-white/[0.07] bg-black/40 px-3 py-2 text-[11px] text-neutral-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            <span>
              Pool <span className="font-semibold tabular-nums text-neutral-100">{formatCoins(totalPoolAmount)}</span>
            </span>
            <span className="hidden sm:inline text-neutral-600">·</span>
            <span>
              <span className="font-semibold tabular-nums text-neutral-100">{boardEntryCount}</span>{" "}
              entries
            </span>
            {isLoggedIn ? (
              <>
                <span className="hidden sm:inline text-neutral-600">·</span>
                <span>
                  Your entries{" "}
                  <span className="font-semibold tabular-nums text-neutral-100">
                    {formatCoins(coinsUsedInContest)}
                  </span>
                </span>
                <span className="hidden sm:inline text-neutral-600">·</span>
                <span>
                  <span className="font-semibold tabular-nums text-ft-gold">
                    {formatCoins(odds.myCoinsRemainingInContest)}
                  </span>{" "}
                  remaining
                </span>
              </>
            ) : null}
            {mostBackedLane ? (
              <>
                <span className="hidden sm:inline text-neutral-600">·</span>
                <span>
                  Leader:{" "}
                  <span className="font-medium text-neutral-200">{mostBackedLane.name}</span>
                </span>
              </>
            ) : null}
            <span className="hidden sm:inline text-neutral-600">·</span>
            <span>
              Updated <span className="tabular-nums text-neutral-300">{marketUpdatedLabel}</span>
            </span>
            {isLoggedIn && coinsUsedInContest >= REQUIRED_TOTAL_WAGER_PER_CONTEST ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Allocated
              </span>
            ) : null}
          </div>
        </div>

      <div className="overflow-x-auto rounded-ft border border-white/[0.07] shadow-ft-card">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm min-w-[720px]">
          <colgroup>
            <col className="w-[56px]" />
            <col className="w-[22%]" />
            <col className="w-[72px]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[72px]" />
          </colgroup>

          <thead className="border-b border-white/[0.06] bg-ft-charcoal/95 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            <tr>
              <th className="px-2 py-2.5 text-center">Mkt</th>
              <th className="px-2 py-2.5 text-left">Runner</th>
              <th className="px-2 py-2.5 text-right">Live FP</th>
              <th className="px-2 py-2.5 text-left">Odds</th>
              <th className="px-2 py-2.5 text-left">Pool share</th>
              <th className="px-2 py-2.5 text-left">Your pos.</th>
              <th className="px-2 py-2.5 text-right">Proj</th>
            </tr>
          </thead>

          <tbody>
            {sortedLanes.map((lane) => {
              const winTotal = odds.laneTotals[lane.id]?.WIN ?? 0;
              const winMultiple = odds.estMultiples[lane.id]?.WIN ?? null;
              const headline = getWinHeadline(winMultiple, lane.openingWinOddsTo1);
              const active = selectedLaneId === lane.id;
              const showProjectionShell = !hasPoolEntries && winMultiple == null;
              const marketRank = marketRanks.get(lane.id) ?? null;
              const matchup = laneMatchupLine(lane);

              const isQuestionable = lane.status === "QUESTIONABLE";
              const isDoubtful = lane.status === "DOUBTFUL";
              const isScratched = lane.status === "SCRATCHED";

              const rowClassName = [
                active
                  ? "bg-gradient-to-r from-ft-gold/[0.09] via-ft-gold/[0.04] to-transparent shadow-[inset_4px_0_0_0_rgba(212,175,55,0.9)] ring-1 ring-inset ring-ft-gold/30"
                  : "hover:bg-white/[0.04]",
                isScratched ? "opacity-55 bg-red-950/25" : "",
                !isScratched && isDoubtful ? "bg-orange-950/20" : "",
                !isScratched && isQuestionable ? "bg-yellow-950/15" : "",
                "cursor-pointer border-b border-white/[0.04] text-neutral-100 transition-colors duration-ft",
              ].join(" ");

              const myStake = laneTotals.get(lane.id) ?? 0;
              const estReturn =
                myStake > 0 && winMultiple != null ? Math.floor(myStake * winMultiple) : null;
              const playerLabel = lane.name;
              const projectedPts = formatProjectedPoints(lane.projectedPoints);
              const projectedRank = lane.seedRank ?? lane.displayOrder ?? null;
              const liveFp = showProjectionShell
                ? projectedPts ?? "—"
                : ((lane.liveFantasyPoints ?? lane.fantasyPoints) ?? 0)
                    .toFixed(1)
                    .replace(/\.0$/, "");

              return (
                <Fragment key={lane.id}>
                  <tr
                    data-lane-row={lane.id}
                    tabIndex={inlineSlipLaneId === lane.id ? -1 : undefined}
                    className={rowClassName}
                    onClick={() => {
                      if (isScratched) return;
                      setSelectedLaneId(lane.id);
                      setInlineSlipLaneId((current) => (current === lane.id ? null : lane.id));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (isScratched) return;
                        setSelectedLaneId(lane.id);
                        setInlineSlipLaneId((current) => (current === lane.id ? null : lane.id));
                      }
                    }}
                  >
                    <td className="px-2 py-3 align-middle text-center">
                      <span className="text-sm font-bold tabular-nums text-neutral-100">
                        {marketRank != null ? `#${marketRank}` : "—"}
                      </span>
                    </td>

                    <td className="px-2 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={[
                            "min-w-0 truncate text-[14px] font-semibold leading-snug text-neutral-50",
                            isScratched ? "text-neutral-500 line-through" : "",
                          ].join(" ")}
                        >
                          {playerLabel}
                        </span>
                        {renderLaneStatus(lane.status)}
                      </div>
                      {matchup ? (
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-neutral-500">
                          {matchup}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-2 py-3 align-middle text-right">
                      <span
                        className={[
                          "text-sm font-bold tabular-nums text-neutral-100",
                          active ? "text-ft-gold-bright" : "",
                        ].join(" ")}
                      >
                        {liveFp}
                      </span>
                      {lane.scoringBreakdown ? (
                        <div className="mt-0.5 flex justify-end">
                          <ScoringBreakdownAccordion
                            breakdown={lane.scoringBreakdown}
                            open={openScoringLaneId === lane.id}
                            onToggle={() =>
                              setOpenScoringLaneId(openScoringLaneId === lane.id ? null : lane.id)
                            }
                          />
                        </div>
                      ) : null}
                    </td>

                    <td className="px-2 py-3 align-middle">
                      {showProjectionShell ? (
                        <p className="text-xs text-neutral-500">Awaiting pool</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={[
                              "text-sm font-semibold tabular-nums text-neutral-100",
                              isScratched ? "text-neutral-500 line-through" : "",
                            ].join(" ")}
                          >
                            {headline.label}
                          </span>
                          {headline.badge === "LIVE" ? (
                            <span className="rounded border border-ft-gold/35 bg-ft-gold/10 px-1 py-0.5 text-[9px] font-bold uppercase text-ft-gold">
                              Live
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td className="px-2 py-3 align-middle">
                      {showProjectionShell ? (
                        <span className="text-sm text-neutral-500">—</span>
                      ) : (
                        <>
                          <p className="text-sm font-semibold tabular-nums text-neutral-100">
                            {formatCoins(winTotal)}
                          </p>
                          <p className="text-[11px] tabular-nums text-neutral-500">
                            {formatPoolShare(winTotal, winPoolTotal)}
                          </p>
                        </>
                      )}
                    </td>

                    <td className="px-2 py-3 align-middle">
                      {myStake > 0 ? (
                        <>
                          <p className="text-sm font-semibold tabular-nums text-ft-gold">
                            {formatCoins(myStake)}
                          </p>
                          <p className="text-[11px] tabular-nums text-neutral-500">
                            {estReturn != null ? `Est. ${formatCoins(estReturn)}` : "Entered"}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm text-neutral-600">—</span>
                      )}
                    </td>

                    <td className="px-2 py-3 align-middle text-right">
                      <span className="text-sm font-semibold tabular-nums text-neutral-300">
                        {projectedRank != null ? `#${projectedRank}` : "—"}
                      </span>
                    </td>
                  </tr>

                  {inlineSlipLaneId === lane.id && (
                    <tr className="border-b border-ft-gold/25 bg-gradient-to-r from-ft-gold/[0.06] via-black/40 to-transparent">
                      <td colSpan={7} className="p-0">
                        {renderQuickEntry(lane, playerLabel, headline)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-600">
        Free-play currency only — not real-money wagering. Closing odds are preserved at lock.
      </p>

      <div id="bet-slip" className="grid gap-5 lg:grid-cols-2 lg:items-start scroll-mt-28">
        <div className="space-y-6 rounded-ft-lg border border-white/[0.09] bg-gradient-to-b from-black/40 to-black/20 p-5 shadow-ft-slip backdrop-blur-sm transition-all duration-300 ease-out hover:border-white/[0.14] sm:p-6">
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold tracking-tight text-neutral-50">Race entry</h3>
            <p className="text-sm leading-relaxed text-neutral-500">
              Parimutuel pool — your stake shifts the line for everyone. Review allocation, then confirm.
            </p>
          </div>

          <div className="rounded-ft-lg border border-white/[0.08] bg-gradient-to-b from-ft-charcoal/95 to-black/70 p-5 shadow-inner sm:p-6">
            <p className="ft-label text-neutral-500">Contest allocation</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs text-neutral-500">Committed</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-50">
                  {formatCoins(coinsUsedInContest)}
                  <span className="text-xl font-semibold text-neutral-500">
                    {" "}
                    / {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500">Available to stake</p>
                <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-ft-gold">
                  {formatCoins(odds.myCoinsRemainingInContest)}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Progress to full allocation</span>
                <span className="tabular-nums font-medium text-neutral-400">
                  {Math.round(allocationProgress)}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-inset ring-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ft-gold-dim via-ft-gold to-ft-gold-bright transition-all duration-500 ease-out"
                  style={{ width: `${allocationProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] pt-4 text-xs text-neutral-500">
              <span>Min {formatCoins(MIN_BET_AMOUNT)} · $5 steps</span>
              <span>Single cap {formatCoins(MAX_BET_AMOUNT)}</span>
              <span>WPS leg cap {formatCoins(MAX_WPS_BET_AMOUNT)}</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
              Required contest allocation: {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}. You can spread it
              across players and markets until lock.
            </p>
          </div>

          {selectedLaneIsScratched ? (
            <div className="rounded-ft-lg border border-red-500/35 bg-red-950/25 p-4 text-sm text-neutral-200">
              <p className="font-semibold text-red-300">Selected player is scratched</p>
              <p className="mt-2 leading-relaxed text-neutral-400">
                Scratched lanes stay visible but cannot take new wagers. Existing tickets on this player are
                refunded.
              </p>
            </div>
          ) : null}

          {isMaxedOut ? (
            <p className="rounded-ft border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
              You are maxed out for this contest.
            </p>
          ) : null}

          {!isLoggedIn ? (
            <p className="text-sm text-neutral-400">
              <Link href="/auth/login" className="font-semibold text-ft-gold underline-offset-4 hover:underline">
                Log in
              </Link>{" "}
              to place bets.
            </p>
          ) : null}

          {bettingClosed ? (
            <p className="rounded-ft border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">
              Betting is closed for this contest.
            </p>
          ) : !canBetByStatus ? (
            <p className="rounded-ft border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">
              Contest is not open for betting.
            </p>
          ) : null}

          <div className="space-y-3">
            <label htmlFor="slip-lane-select" className="ft-label text-neutral-500">
              Player
            </label>
            <select
              id="slip-lane-select"
              value={selectedLaneId}
              onChange={(event) => setSelectedLaneId(event.target.value)}
              className="w-full rounded-ft border border-white/10 bg-black/50 py-3.5 pl-4 pr-10 text-base font-medium text-neutral-100 shadow-inner transition duration-ft focus:border-ft-gold/40 focus:outline-none focus:ring-2 focus:ring-ft-gold/20 disabled:opacity-50"
            >
              {lanes.map((lane) => {
                const isScratched = lane.status === "SCRATCHED";
                const suffix =
                  lane.status === "SCRATCHED"
                    ? " — Scratched"
                    : lane.status === "DOUBTFUL"
                    ? " — Doubtful"
                    : lane.status === "QUESTIONABLE"
                    ? " — Questionable"
                    : "";

                return (
                  <option key={lane.id} value={lane.id} disabled={isScratched}>
                    {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                    {suffix}
                  </option>
                );
              })}
            </select>

            {selectedLane ? (
              <div
                className={
                  "rounded-ft-lg border p-5 transition-all duration-300 ease-out " +
                  (selectedLaneIsScratched
                    ? "border-red-500/30 bg-red-950/20"
                    : "border-ft-gold/35 bg-gradient-to-br from-ft-gold/[0.09] via-black/50 to-black/70 shadow-[0_0_40px_-12px_rgba(212,175,55,0.2)]")
                }
              >
                <p className="ft-label text-neutral-500">Active ticket</p>
                <p
                  className={
                    "mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-[1.65rem] " +
                    (selectedLaneIsScratched ? "text-neutral-500 line-through" : "text-neutral-50")
                  }
                >
                  {selectedRunnerLabel}
                </p>
                {slipWinHeadline ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
                    <span className="text-xs text-neutral-500">WIN line (est.)</span>
                    <span className="text-xl font-bold tabular-nums text-neutral-100">{slipWinHeadline.label}</span>
                    {slipWinHeadline.badge ? (
                      <span
                        className={
                          slipWinHeadline.badge === "LIVE"
                            ? "rounded-full border border-ft-gold/40 bg-ft-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold"
                            : "rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-400"
                        }
                      >
                        {slipWinHeadline.badge}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-6 rounded-ft-lg border border-white/[0.07] bg-black/35 p-5 sm:p-6">
            <div>
              <p className="ft-label text-neutral-500">Single market</p>
              <p className="mt-1 text-lg font-semibold text-neutral-100">Stake one pool</p>
              <p className="mt-1 text-xs text-neutral-500">WIN, PLACE, or SHOW — one wager per submit.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {markets.map((market) => (
                <button
                  key={market}
                  type="button"
                  onClick={() => setSelectedMarket(market)}
                  className={
                    "rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-ft " +
                    (selectedMarket === market
                      ? "border-ft-gold/45 bg-ft-gold/12 text-ft-gold shadow-ft-inner"
                      : "border-white/10 bg-white/[0.04] text-neutral-400 hover:border-white/20 hover:text-neutral-200")
                  }
                >
                  {market}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-1 sm:gap-5 lg:grid-cols-[1fr_minmax(0,11rem)] lg:items-end">
              <div className="space-y-2">
                <label htmlFor="slip-single-amount" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Wager amount
                </label>
                <input
                  id="slip-single-amount"
                  type="number"
                  min={MIN_BET_AMOUNT}
                  max={MAX_BET_AMOUNT}
                  step={5}
                  value={singleAmount}
                  onChange={(event) => setSingleAmount(event.target.value)}
                  className="w-full min-h-[3.25rem] rounded-ft border border-white/10 bg-black/50 px-4 py-3 text-3xl font-bold tabular-nums text-neutral-50 shadow-inner transition duration-ft focus:border-ft-gold/40 focus:outline-none focus:ring-2 focus:ring-ft-gold/15 disabled:opacity-50"
                  disabled={disableAllBetActions || isPending}
                />
              </div>
              <button
                type="button"
                onClick={() => void placeSingleBet()}
                disabled={disableAllBetActions || isPending}
                className="ft-btn-primary flex min-h-[3.25rem] w-full items-center justify-center px-6 text-base font-bold disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none"
              >
                {bettingClosed
                  ? "Betting closed"
                  : selectedLaneIsScratched
                  ? "Lane scratched"
                  : `Enter ${selectedMarket}`}
              </button>
            </div>

            <p className="text-xs leading-relaxed text-neutral-500">
              Increments of $5. Max single entry {formatCoins(MAX_BET_AMOUNT)}.
            </p>

            {singleTooSmall ? (
              <p className="text-sm font-medium text-red-400">Minimum bet is {formatCoins(MIN_BET_AMOUNT)}.</p>
            ) : null}
            {singleNotIncrement ? (
              <p className="text-sm font-medium text-red-400">Bets must be in increments of $5.</p>
            ) : null}
            {singleTooLarge ? (
              <p className="text-sm font-medium text-red-400">
                Maximum single bet is {formatCoins(MAX_BET_AMOUNT)}.
              </p>
            ) : null}

            {selectedMarket === Market.WIN &&
            projectedSingleWinMultiple !== null &&
            Number.isFinite(parsedSingleAmount) &&
            parsedSingleAmount > 0 ? (
              <div className="rounded-ft-lg border border-ft-gold/30 bg-ft-gold/[0.06] px-5 py-6 text-center shadow-inner">
                <p className="ft-label text-neutral-500">Estimated return (if WIN hits)</p>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-ft-gold sm:text-[2.75rem]">
                  {formatCoins(parsedSingleAmount * projectedSingleWinMultiple)}
                </p>
                <p className="mt-2 text-sm text-neutral-400">
                  Implied multiple ×{projectedSingleWinMultiple.toFixed(2)} on this stake — pool will move when you
                  confirm.
                </p>
              </div>
            ) : null}

            <div className="rounded-ft border border-white/[0.06] bg-black/30 p-4 text-sm">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Line items</h4>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <dt className="text-neutral-500">Player</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-neutral-100">
                    {selectedLane ? selectedRunnerLabel : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <dt className="text-neutral-500">Market</dt>
                  <dd className="text-right font-semibold text-neutral-100">{selectedMarket ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <dt className="text-neutral-500">Stake</dt>
                  <dd className="text-right text-lg font-bold tabular-nums text-neutral-50">
                    {Number.isFinite(parsedSingleAmount) && parsedSingleAmount > 0
                      ? formatCoins(parsedSingleAmount)
                      : "—"}
                  </dd>
                </div>
                {selectedMarket === Market.WIN && projectedSingleWinMultiple !== null && (
                  <div className="flex justify-between gap-3 pt-1">
                    <dt className="text-neutral-500">Pool multiple (after stake)</dt>
                    <dd className="text-right text-lg font-semibold tabular-nums text-ft-gold">
                      ×{projectedSingleWinMultiple.toFixed(2)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-[11px] leading-relaxed text-neutral-600">
                Submitting adds your stake to the pool and can tighten this player&apos;s WIN price for everyone —
                especially in thin markets.
              </p>
            </div>

            {selectedMarket === Market.WIN &&
            singleValid &&
            selectedLaneId &&
            canBetByStatus &&
            !bettingClosed &&
            !selectedLaneIsScratched ? (
              <div className="rounded-ft-lg border border-ft-gold/20 bg-gradient-to-br from-ft-gold/[0.06] to-transparent p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-200">How this bet moves the board</p>
                    <p className="text-sm leading-relaxed text-neutral-500">
                      More money on this player lowers the WIN payout for everyone still betting WIN — other lanes
                      become relatively richer until the next wager.
                    </p>
                  </div>
                  <OddsMoveInfoPopover />
                </div>
                <p className="mt-4 text-base font-semibold tabular-nums text-neutral-100">
                  After you bet, est. WIN multiple ≈{" "}
                  {projectedSingleWinMultiple === null ? "—" : `${projectedSingleWinMultiple.toFixed(2)}×`}
                </p>
                <p className="mt-1 text-xs text-neutral-500">Estimate only; updates as others wager.</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 rounded-ft-lg border border-white/[0.07] bg-black/35 p-5 sm:p-6">
            <div>
              <p className="ft-label text-neutral-500">WPS bundle</p>
              <p className="mt-1 text-lg font-semibold text-neutral-100">WIN + PLACE + SHOW</p>
              <p className="mt-1 text-xs text-neutral-500">
                One leg amount applies to all three pools. Total charge = 3× the amount shown.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,11rem)] lg:items-end">
              <div className="space-y-2">
                <label htmlFor="slip-wps-amount" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Per-leg amount
                </label>
                <input
                  id="slip-wps-amount"
                  type="number"
                  min={MIN_BET_AMOUNT}
                  max={MAX_WPS_BET_AMOUNT}
                  step={5}
                  value={wpsAmount}
                  onChange={(event) => setWpsAmount(event.target.value)}
                  className="w-full min-h-[3.25rem] rounded-ft border border-white/10 bg-black/50 px-4 py-3 text-3xl font-bold tabular-nums text-neutral-50 shadow-inner transition duration-ft focus:border-ft-gold/40 focus:outline-none focus:ring-2 focus:ring-ft-gold/15 disabled:opacity-50"
                  disabled={disableAllBetActions || isPending}
                />
              </div>
              <button
                type="button"
                onClick={() => void placeWpsBet()}
                disabled={disableAllBetActions || isPending}
                className="ft-btn-primary flex min-h-[3.25rem] w-full items-center justify-center px-6 text-base font-bold disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {bettingClosed ? "Entries closed" : selectedLaneIsScratched ? "Lane scratched" : "Enter WPS"}
              </button>
            </div>

            <div className="rounded-ft border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total WPS charge</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-50">
                {formatCoins(Math.max(0, parsedWpsAmount || 0) * 3)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">3 × {formatCoins(Math.max(0, parsedWpsAmount || 0))} per leg</p>
            </div>

            <p className="text-xs leading-relaxed text-neutral-500">
              Max {formatCoins(MAX_WPS_BET_AMOUNT)} per leg · $5 increments.
            </p>

            {wpsTooSmall ? (
              <p className="text-sm font-medium text-red-400">
                Minimum WPS leg amount is {formatCoins(MIN_BET_AMOUNT)}.
              </p>
            ) : null}
            {wpsNotIncrement ? (
              <p className="text-sm font-medium text-red-400">WPS amount must be in increments of $5.</p>
            ) : null}
            {wpsTooLarge ? (
              <p className="text-sm font-medium text-red-400">
                Maximum WPS amount is {formatCoins(MAX_WPS_BET_AMOUNT)} per leg.
              </p>
            ) : null}

            {wpsValid && selectedLaneId && canBetByStatus && !bettingClosed && !selectedLaneIsScratched ? (
              <div className="rounded-ft-lg border border-ft-gold/20 bg-gradient-to-br from-ft-gold/[0.06] to-transparent p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-200">Pool impact</p>
                    <p className="text-sm leading-relaxed text-neutral-500">
                      WPS charges all three legs; the WIN portion shifts the same WIN pool as a single-market bet.
                    </p>
                  </div>
                  <OddsMoveInfoPopover />
                </div>
                <p className="mt-4 text-base font-semibold tabular-nums text-neutral-100">
                  After WPS, est. WIN multiple ≈{" "}
                  {projectedWpsWinMultiple === null ? "—" : `${projectedWpsWinMultiple.toFixed(2)}×`}
                </p>
                <p className="mt-1 text-xs text-neutral-500">Estimate only; updates as others wager.</p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-ft border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-ft border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
              {message}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-ft-lg border border-white/[0.08] bg-black/25 p-5 shadow-ft-card">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-neutral-50">My bets</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Tickets grouped by player — stake, status, and net after settlement.
            </p>
          </div>

          {collapsedMyBets.length === 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3 text-sm text-neutral-300">
              <p>You don&apos;t have any bets in this contest yet.</p>
              <p className="mt-1 text-xs text-neutral-400">
                As you place bets using the slip on the left, they&apos;ll appear here grouped by runner,
                along with stake, payouts, and net results once the contest settles.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ticketsByLane.map((group) => {
                const laneTotal = formatCoins(laneTotals.get(group.laneId) ?? 0);

                return (
                  <div
                    key={group.laneId}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold text-neutral-50">{group.laneName}</div>
                      <div className="text-xs text-neutral-400">Lane total: {laneTotal}</div>
                    </div>

                    <div className="space-y-2">
                      {group.lines.map((line: any) => {
                        const subtitle = line.createdAt ? (
                          <ClientOnly>
                            <span>{formatDateTime(new Date(line.createdAt))}</span>
                          </ClientOnly>
                        ) : (
                          "—"
                        );

                        const resolveTicketId = (): string | null => {
                          if (line.ticketId) return String(line.ticketId);

                          if (line.kind === "WPS") {
                            const rep: any = myBets.find(
                              (b: any) =>
                                b.laneId === line.laneId &&
                                (b.market === Market.WIN ||
                                  b.market === Market.PLACE ||
                                  b.market === Market.SHOW) &&
                                b.ticketId
                            );
                            return rep?.ticketId ? String(rep.ticketId) : null;
                          }

                          if (line.id) {
                            const original: any = myBets.find((b: any) => b.id === line.id);
                            return original?.ticketId ? String(original.ticketId) : null;
                          }

                          return null;
                        };

                        const ticketId = resolveTicketId();
                        const canOpen = Boolean(ticketId);

                        const openTicket = () => {
                          if (!ticketId) return;
                          setSelectedTicketId(ticketId);
                          setTicketOpen(true);
                        };

                        if (line.kind === "WPS") {
                          const wBet: any = myBets.find(
                            (b: any) => b.laneId === line.laneId && b.market === Market.WIN
                          );
                          const pBet: any = myBets.find(
                            (b: any) => b.laneId === line.laneId && b.market === Market.PLACE
                          );
                          const sBet: any = myBets.find(
                            (b: any) => b.laneId === line.laneId && b.market === Market.SHOW
                          );

                          const refunded = Boolean(wBet?.refunded || pBet?.refunded || sBet?.refunded);

                          const winStake = Number(line.win ?? 0);
                          const placeStake = Number(line.place ?? 0);
                          const showStake = Number(line.show ?? 0);

                          const winPayout = Number(wBet?.payout ?? 0);
                          const placePayout = Number(pBet?.payout ?? 0);
                          const showPayout = Number(sBet?.payout ?? 0);

                          const totalStake = winStake + placeStake + showStake;
                          const totalPayout = winPayout + placePayout + showPayout;
                          const net = totalPayout - totalStake;

                          const isSettled = status === ContestStatus.SETTLED;
                          const isWon = isSettled && !refunded && totalPayout > 0;
                          const isLost = isSettled && !refunded && totalPayout === 0;
                          const perLeg = Math.max(winStake, placeStake, showStake);

                          return (
                            <button
                              key={line.key}
                              type="button"
                              onClick={openTicket}
                              disabled={!canOpen}
                              className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                              title={!canOpen ? "Ticket details unavailable" : "View ticket"}
                            >
                              <div
                                className={`rounded-xl border p-3 transition ${
                                  refunded
                                    ? "border-amber-400/70 bg-amber-500/10"
                                    : isWon
                                    ? "border-emerald-400/80 bg-emerald-500/10"
                                    : isLost
                                    ? "border-rose-400/80 bg-rose-500/10"
                                    : "border-neutral-700 bg-neutral-900/80"
                                } ${canOpen ? "hover:shadow-sm" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-neutral-50">WPS</span>
                                      <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                                        grouped
                                      </span>
                                    </div>

                                    <div className="mt-1 text-xs text-neutral-400">{subtitle}</div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs uppercase tracking-wide text-neutral-400">
                                      Stake
                                    </div>
                                    <div className="font-semibold text-neutral-50">
                                      {formatCoins(perLeg)} WPS
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                  <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 p-2">
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${marketBadgeClass(
                                          Market.WIN
                                        )}`}
                                      >
                                        Win
                                      </span>
                                      <span className="text-xs text-neutral-400">
                                        {formatCoins(winStake)}
                                      </span>
                                    </div>
                                    <div
                                      className={`mt-2 text-sm font-semibold ${
                                        refunded
                                          ? "text-amber-200"
                                          : !isSettled
                                          ? "text-neutral-300"
                                          : winPayout > 0
                                          ? "text-emerald-300"
                                          : "text-rose-300"
                                      }`}
                                    >
                                      {refunded
                                        ? "Refunded"
                                        : !isSettled
                                        ? "Pending"
                                        : winPayout > 0
                                        ? `Paid ${formatCoins(winPayout)}`
                                        : "No payout"}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 p-2">
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${marketBadgeClass(
                                          Market.PLACE
                                        )}`}
                                      >
                                        Place
                                      </span>
                                      <span className="text-xs text-neutral-400">
                                        {formatCoins(placeStake)}
                                      </span>
                                    </div>
                                    <div
                                      className={`mt-2 text-sm font-semibold ${
                                        refunded
                                          ? "text-amber-200"
                                          : !isSettled
                                          ? "text-neutral-300"
                                          : placePayout > 0
                                          ? "text-emerald-300"
                                          : "text-rose-300"
                                      }`}
                                    >
                                      {refunded
                                        ? "Refunded"
                                        : !isSettled
                                        ? "Pending"
                                        : placePayout > 0
                                        ? `Paid ${formatCoins(placePayout)}`
                                        : "No payout"}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 p-2">
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${marketBadgeClass(
                                          Market.SHOW
                                        )}`}
                                      >
                                        Show
                                      </span>
                                      <span className="text-xs text-neutral-400">
                                        {formatCoins(showStake)}
                                      </span>
                                    </div>
                                    <div
                                      className={`mt-2 text-sm font-semibold ${
                                        refunded
                                          ? "text-amber-200"
                                          : !isSettled
                                          ? "text-neutral-300"
                                          : showPayout > 0
                                          ? "text-emerald-300"
                                          : "text-rose-300"
                                      }`}
                                    >
                                      {refunded
                                        ? "Refunded"
                                        : !isSettled
                                        ? "Pending"
                                        : showPayout > 0
                                        ? `Paid ${formatCoins(showPayout)}`
                                        : "No payout"}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-neutral-700 pt-3">
                                  <div
                                    className={`text-sm font-semibold ${
                                      refunded
                                        ? "text-amber-200"
                                        : !isSettled
                                        ? "text-neutral-300"
                                        : isWon
                                        ? "text-emerald-300"
                                        : "text-rose-300"
                                    }`}
                                  >
                                    {refunded
                                      ? "Scratched / refunded"
                                      : !isSettled
                                      ? "Awaiting settlement"
                                      : isWon
                                      ? `Total payout: ${formatCoins(totalPayout)}`
                                      : "Settled: no payout"}
                                  </div>

                                  {isSettled && !refunded ? (
                                    <div
                                      className={`text-xs font-semibold ${
                                        net >= 0 ? "text-emerald-300" : "text-rose-300"
                                      }`}
                                    >
                                      Net {net >= 0 ? "+" : ""}
                                      {formatCoins(net)}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        }

                        const original: any = myBets.find((b: any) => b.id === line.id);
                        const refunded = Boolean(original?.refunded);
                        const isSettled = status === ContestStatus.SETTLED;
                        const stake = Number(line.amount ?? 0);
                        const payout = Number(original?.payout ?? 0);
                        const net = payout - stake;
                        const isWon = isSettled && !refunded && payout > 0;
                        const isLost = isSettled && !refunded && payout === 0;

                        return (
                          <button
                            key={line.id}
                            type="button"
                            onClick={openTicket}
                            disabled={!canOpen}
                            className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                            title={!canOpen ? "Ticket details unavailable" : "View ticket"}
                          >
                            <div
                              className={`rounded-xl border p-3 transition ${
                                refunded
                                  ? "border-amber-400/70 bg-amber-500/10"
                                  : isWon
                                  ? "border-emerald-400/80 bg-emerald-500/10"
                                  : isLost
                                  ? "border-rose-400/80 bg-rose-500/10"
                                  : "border-neutral-700 bg-neutral-900/80"
                              } ${canOpen ? "hover:shadow-sm" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-neutral-50">
                                      {String(line.market)}
                                    </span>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${marketBadgeClass(
                                        line.market
                                      )}`}
                                    >
                                      {String(line.market)}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-xs text-neutral-400">{subtitle}</div>
                                </div>

                                <div className="text-right">
                                  <div className="text-xs uppercase tracking-wide text-neutral-400">
                                    Stake
                                  </div>
                                  <div className="font-semibold text-neutral-50">
                                    {formatCoins(stake)}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t border-neutral-700 pt-3">
                                <div
                                  className={`text-sm font-semibold ${
                                    refunded
                                      ? "text-amber-200"
                                      : !isSettled
                                      ? "text-neutral-300"
                                      : isWon
                                      ? "text-emerald-300"
                                      : "text-rose-300"
                                  }`}
                                >
                                  {refunded
                                    ? "Refunded"
                                    : !isSettled
                                    ? "Pending"
                                    : isWon
                                    ? `Paid ${formatCoins(payout)}`
                                    : "No payout"}
                                </div>

                                {isSettled && !refunded ? (
                                  <div
                                    className={`text-xs font-semibold ${
                                      net >= 0 ? "text-emerald-300" : "text-rose-300"
                                    }`}
                                  >
                                    Net {net >= 0 ? "+" : ""}
                                    {formatCoins(net)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <TicketDetailModal
            ticketId={selectedTicketId}
            open={ticketOpen}
            onClose={() => setTicketOpen(false)}
          />

          <div className="pt-2">
            <h3 className="font-semibold text-neutral-50">My bets (details)</h3>

            {myBets.length === 0 ? null : (
              <div
                ref={myBetsScrollRef}
                className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded border border-neutral-800 bg-neutral-950/80 p-2"
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900 text-neutral-300">
                    <tr>
                      <th className="py-1 text-left">Lane</th>
                      <th className="py-1 text-left">Market</th>
                      <th className="py-1 text-left">Wager</th>
                      <th className="py-1 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-100">
                    {myBets.map((bet: any) => (
                      <tr
                        key={bet.id}
                        className={
                          bet.refunded
                            ? "bg-amber-500/10"
                            : status === ContestStatus.SETTLED
                            ? "bg-emerald-500/10"
                            : ""
                        }
                      >
                        <td className="py-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={bet.refunded ? "text-neutral-500 line-through" : ""}>
                                {bet.laneName}
                              </span>
                              {bet.refunded ? (
                                <span className="rounded border border-amber-400/70 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
                                  Refunded
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-neutral-400">
                              Total: {formatCoins(laneTotals.get(bet.laneId) ?? 0)}
                            </span>
                          </div>
                        </td>
                        <td className="py-1">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs font-semibold ${marketBadgeClass(
                              bet.market
                            )}`}
                          >
                            {bet.market}
                          </span>
                        </td>
                        <td className="py-1">
                          <span className={bet.refunded ? "text-neutral-500 line-through" : ""}>
                            {formatCoins(bet.amount)}
                          </span>
                        </td>
                        <td className="py-1 text-neutral-400">
                          <ClientOnly>
                            <span>{formatDateTime(new Date(bet.createdAt))}</span>
                          </ClientOnly>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {pageEmphasis === "PRE_RACE" ? <div className="pt-1">{liveBoardNode}</div> : null}

      {status === ContestStatus.SETTLED && (
        <div className="rounded-ft-lg border border-white/[0.08] bg-black/35 p-5 text-sm shadow-ft-card">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold tracking-tight text-neutral-50">Final results</p>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              Settled
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {lanes
              .filter((lane) => lane.finalRank !== null)
              .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999))
              .map((lane) => {
                const rank = lane.finalRank ?? 999;
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;

                const rowClass = isGold
                  ? "border-ft-gold/40 bg-gradient-to-r from-ft-gold/12 to-black/40 shadow-ft-glow-gold"
                  : isSilver
                  ? "border-white/15 bg-white/[0.04]"
                  : isBronze
                  ? "border-orange-500/35 bg-orange-950/25"
                  : "border-white/[0.06] bg-black/20";

                const badgeClass = isGold
                  ? "border-ft-gold/50 bg-ft-gold/15 text-ft-gold"
                  : isSilver
                  ? "border-white/20 bg-white/10 text-neutral-200"
                  : isBronze
                  ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
                  : "border-white/10 bg-white/[0.06] text-neutral-400";

                const medalLabel = isGold
                  ? "1st"
                  : isSilver
                  ? "2nd"
                  : isBronze
                  ? "3rd"
                  : `#${rank}`;

                return (
                  <div
                    key={lane.id}
                    className={`flex items-center justify-between rounded-ft border px-3 py-3 transition hover:border-white/15 ${rowClass}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass}`}
                      >
                        {medalLabel}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-neutral-100">{lane.name}</span>
                          {isGold ? (
                            <span className="rounded-full border border-ft-gold/30 bg-ft-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
                              Podium
                            </span>
                          ) : isSilver ? (
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-400">
                              Podium
                            </span>
                          ) : isBronze ? (
                            <span className="rounded-full border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-200/90">
                              Podium
                            </span>
                          ) : null}
                        </div>

                        <div className="truncate text-xs text-neutral-500">
                          {lane.team} · {lane.position}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        FP
                      </div>
                      <div className="font-bold tabular-nums text-neutral-50">
                        {lane.fantasyPoints !== null ? lane.fantasyPoints : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28%)] lg:items-start lg:gap-6">
      {marketBranch}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="hidden lg:block">{enterRaceRail}</div>
        {children}
      </aside>
    </div>
  );
}