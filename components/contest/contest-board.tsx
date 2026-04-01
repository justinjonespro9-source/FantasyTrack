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
import { ShareContestButton } from "@/components/contest/share-contest-button";
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
  finalRank: number | null;
  openingWinOddsTo1: number | null;
  fantasyPoints: number | null;
  /** Live-only in-race fantasy points; final points remain on fantasyPoints. */
  liveFantasyPoints?: number | null;
  status: LaneStatus;
  /** Optional per-player scoring breakdown, e.g. basketball raw stats. */
  scoringBreakdown?: ScoringBreakdown | null;
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
  /** From live BoxScore pull (0–100). When set, progress bar uses this instead of time. */
  liveGameProgress?: number | null;
  /** From live BoxScore pull (e.g. InProgress, Final). Used for progress label when present. */
  liveGameStatus?: string | null;
};

type WinHeadline = {
  label: string;
  badge: "LIVE" | "OPEN" | null;
  helper: string | null;
};

type LaneSortKey = "WIN_ODDS" | "PLAYER";

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

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Locked";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

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
    label: "—",
    badge: null,
    helper: null,
  };
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
  liveGameProgress,
  liveGameStatus,
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
  const [sortKey, setSortKey] = useState<LaneSortKey>("WIN_ODDS");
  const [isPending, startTransition] = useTransition();

  const [ticketOpen, setTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileBetTab, setMobileBetTab] = useState<"slip" | "bets">("slip");

  // Inline slip opened under a specific odds row (live board)
  const [inlineSlipLaneId, setInlineSlipLaneId] = useState<string | null>(null);
  const [openScoringLaneId, setOpenScoringLaneId] = useState<string | null>(null);

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

  const sortedLanes = useMemo(() => {
    const copy = [...lanes];

    copy.sort((a, b) => {
      if (sortKey === "PLAYER") {
        return compareStrings(getSortablePlayerName(a.name), getSortablePlayerName(b.name));
      }

      const aWinMultiple =
        odds.estMultiples[a.id]?.WIN ??
        (a.openingWinOddsTo1 != null ? a.openingWinOddsTo1 + 1 : 9999);
      const bWinMultiple =
        odds.estMultiples[b.id]?.WIN ??
        (b.openingWinOddsTo1 != null ? b.openingWinOddsTo1 + 1 : 9999);

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

  async function refreshOdds() {
    const res = await fetch(`/api/contest/${contestId}/odds`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok) {
      const payload = (await res.json()) as OddsPayload;
      setOdds(payload);
    }
  }

  useEffect(() => {
    if (bettingClosed) return;

    const timer = setInterval(() => {
      void refreshOdds();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: poll depends only on contestId/bettingClosed; refreshOdds is not stable
  }, [contestId, bettingClosed]);

  async function placeSingleBet() {
    setError("");
    setMessage("");

    if (selectedLaneIsScratched) {
      setError("Scratched lanes cannot accept new wagers.");
      return;
    }

    if (bettingClosed) {
      setError("Betting is closed for this contest.");
      return;
    }

    if (disableAllBetActions) return;

    if (!Number.isInteger(parsedSingleAmount) || singleTooSmall) {
      setError(`Minimum bet is ${formatCoins(MIN_BET_AMOUNT)}.`);
      return;
    }

    if (singleNotIncrement) {
      setError("Bets must be placed in increments of $5.");
      return;
    }

    if (singleTooLarge) {
      setError(`Maximum single bet is ${formatCoins(MAX_BET_AMOUNT)}.`);
      return;
    }

    if (odds.myCoinsRemainingInContest < parsedSingleAmount) {
      setError("This wager exceeds your remaining contest allocation.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contest/${contestId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: selectedLaneId,
          market: selectedMarket,
          amount: parsedSingleAmount,
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
        setError(payload.error ?? "Failed to place bet.");
        return;
      }

      if (payload.odds) setOdds(payload.odds);
      else await refreshOdds();

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

      setMessage("Bet placed.");
    });
  }

  async function placeWpsBet() {
    setError("");
    setMessage("");

    if (selectedLaneIsScratched) {
      setError("Scratched lanes cannot accept new wagers.");
      return;
    }

    if (bettingClosed) {
      setError("Betting is closed for this contest.");
      return;
    }

    if (disableAllBetActions) return;

    if (!Number.isInteger(parsedWpsAmount) || wpsTooSmall) {
      setError(`Minimum WPS leg amount is ${formatCoins(MIN_BET_AMOUNT)}.`);
      return;
    }

    if (wpsNotIncrement) {
      setError("WPS amount must be in increments of $5.");
      return;
    }

    if (wpsTooLarge) {
      setError(`Maximum WPS amount is ${formatCoins(MAX_WPS_BET_AMOUNT)} per leg.`);
      return;
    }

    const totalCost = parsedWpsAmount * 3;
    if (odds.myCoinsRemainingInContest < totalCost) {
      setError("WPS total wager exceeds your remaining contest allocation.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/contest/${contestId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: selectedLaneId,
          action: "WPS",
          amount: parsedWpsAmount,
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
        setError(payload.error ?? "Failed to place WPS.");
        return;
      }

      if (payload.odds) setOdds(payload.odds);
      else await refreshOdds();

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

      setMessage("WPS placed (WIN + PLACE + SHOW). Total wager charged.");
    });
  }

  const sportLabel = formatSportLabel(sport as any);
  const trackConditionsLabel = formatTrackConditionsLabel(trackConditions);

  return (
    <section className="relative isolate overflow-hidden rounded-ft-lg border border-white/[0.07] bg-ft-gradient-panel p-5 shadow-ft-card backdrop-blur-sm sm:p-6">
      <div className="pointer-events-none absolute inset-0 z-0 bg-ft-radial-gold opacity-90" />
      <div className="relative z-10 space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">{title}</h2>
          <p className="ft-label text-neutral-500 sm:text-[11px]">
            Starts{" "}
            <ClientOnly>
              <span>{formatDateTime(new Date(startTime))}</span>
            </ClientOnly>{" "}
            · {status}
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300">
              {sportLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              {trackConditionsLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-xs sm:justify-end sm:text-sm">
          <ShareContestButton contestId={contestId} contestTitle={title} />
          <Link href="/how-to-play" className="ft-btn-ghost px-3 py-1.5 text-xs sm:text-sm">
            How to Play
          </Link>

          {!bettingClosed ? (
            <div className="rounded-full border border-ft-gold/30 bg-ft-gold/5 px-3 py-1.5 text-xs text-neutral-200 shadow-ft-inner sm:text-sm">
              <span className="hidden text-neutral-500 sm:inline">Locks in </span>
              <span className="font-bold tabular-nums text-ft-gold">
                {formatCountdown(odds.timeToLockSeconds)}
              </span>
            </div>
          ) : (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-400 sm:text-sm">
              Betting closed
            </div>
          )}
        </div>
      </header>

      {/* Hero: live standings — primary focal point */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-px rounded-ft-lg bg-gradient-to-b from-ft-gold/15 via-transparent to-transparent opacity-80"
          aria-hidden
        />
        <div className="relative rounded-ft-lg border border-ft-gold/20 bg-black/20 p-1 shadow-[0_0_48px_-8px_rgba(212,175,55,0.18)] sm:p-1.5">
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
          />
        </div>
      </div>

      {bettingClosed ? (
        <div className="rounded-ft border border-white/10 bg-black/40 p-4 text-sm text-neutral-300 shadow-inner">
          <div className="font-semibold text-neutral-100">Betting is closed</div>
          <div className="mt-1 text-neutral-500">
            This contest has been locked and can no longer accept wagers.
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
        <div className="space-y-1.5">
          <p className="ft-label text-neutral-500">Markets</p>
          <p className="text-lg font-bold tracking-tight text-neutral-50">Odds &amp; pools</p>
          <p className="max-w-lg text-xs leading-relaxed text-neutral-500">
            Estimates move with the pool until lock; final WIN price is fixed at lock.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
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
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-neutral-100 transition hover:border-ft-gold/30"
          >
            <option value="WIN_ODDS">Odds - High to Low</option>
            <option value="PLAYER">Player A-Z</option>
          </select>
        </div>
      </div>

      {isLoggedIn && (
        <div className="rounded-ft border border-white/[0.07] bg-black/35 px-4 py-3 text-sm shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-neutral-500">
              <span>
                Required{" "}
                <span className="ml-1 font-semibold tabular-nums text-neutral-100">
                  {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}
                </span>
              </span>
              <span>
                Wagered{" "}
                <span className="ml-1 font-semibold tabular-nums text-neutral-100">
                  {formatCoins(coinsUsedInContest)}
                </span>
              </span>
              <span>
                Remaining{" "}
                <span className="ml-1 font-semibold tabular-nums text-ft-gold">
                  {formatCoins(odds.myCoinsRemainingInContest)}
                </span>
              </span>
            </div>
            {coinsUsedInContest >= REQUIRED_TOTAL_WAGER_PER_CONTEST && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Allocated
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-ft border border-white/[0.07] shadow-ft-card">
        <div className="max-h-[30rem] overflow-y-auto">
          <table className="w-full table-auto border-separate border-spacing-0 text-left text-sm md:table-fixed md:min-w-[760px]">
          <colgroup>
            <col className="min-w-[200px] md:w-[240px]" />
            <col className="w-[76px]" />
            <col className="w-[108px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
          </colgroup>

          <thead className="sticky top-0 z-10 border-b border-white/[0.06] bg-ft-charcoal/95 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 backdrop-blur-md">
            <tr>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-2 py-3 text-right">
                <span className="inline-block text-right">Live FP</span>
              </th>
              <th
                className="px-3 py-3 text-left"
                title="LIVE = current WIN pool estimate (moves with wagers). OPEN = posted opening line when the WIN pool is empty. Final market WIN odds are fixed at lock."
              >
                To-win
              </th>
              <th className="px-3 py-3 text-left">
                WIN pool
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums tracking-normal text-neutral-400">
                  {formatCoins(odds.poolTotals.WIN)}
                </div>
              </th>
              <th className="px-3 py-3 text-left">
                PLACE
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums tracking-normal text-neutral-500">
                  {formatCoins(odds.poolTotals.PLACE)}
                </div>
              </th>
              <th className="px-3 py-3 text-left">
                SHOW
                <div className="mt-0.5 text-[11px] font-semibold tabular-nums tracking-normal text-neutral-500">
                  {formatCoins(odds.poolTotals.SHOW)}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedLanes.map((lane) => {
              const winTotal = odds.laneTotals[lane.id]?.WIN ?? 0;
              const winMultiple = odds.estMultiples[lane.id]?.WIN ?? null;
              const headline = getWinHeadline(winMultiple, lane.openingWinOddsTo1);
              const active = selectedLaneId === lane.id;

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

              const placeTotal = odds.laneTotals[lane.id]?.PLACE ?? 0;
              const showTotal = odds.laneTotals[lane.id]?.SHOW ?? 0;
              const playerLabel = formatLaneDisplayName(lane.name, lane.position, lane.team);

              return (
                <Fragment key={lane.id}>
                  <tr
                    className={rowClassName}
                    onClick={() => {
                      if (isScratched) return;
                      setSelectedLaneId(lane.id);
                      setInlineSlipLaneId((current) => (current === lane.id ? null : lane.id));
                    }}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={[
                            "min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-50",
                            isScratched ? "text-neutral-500 line-through" : "",
                          ].join(" ")}
                        >
                          {playerLabel}
                        </span>
                        {renderLaneStatus(lane.status) ? (
                          <span className="inline-flex shrink-0">{renderLaneStatus(lane.status)}</span>
                        ) : null}
                      </div>
                    </td>

                  <td className="px-2 py-2.5 align-middle text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={[
                          "text-lg font-bold tabular-nums tracking-tight text-neutral-100",
                          active ? "text-ft-gold-bright" : "",
                        ].join(" ")}
                      >
                        {((lane.liveFantasyPoints ?? lane.fantasyPoints) ?? 0)
                          .toFixed(2)
                          .replace(/\.?0+$/, "")}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                        pts
                      </span>
                      <ScoringBreakdownAccordion
                        breakdown={lane.scoringBreakdown}
                        open={openScoringLaneId === lane.id}
                        onToggle={() =>
                          setOpenScoringLaneId(openScoringLaneId === lane.id ? null : lane.id)
                        }
                      />
                    </div>
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={[
                            "font-semibold tabular-nums text-neutral-100",
                            isScratched ? "text-neutral-500 line-through" : "",
                          ].join(" ")}
                        >
                          {headline.label}
                        </span>
                        {headline.badge && (
                          <span
                            className={
                              headline.badge === "LIVE"
                                ? "rounded-full border border-ft-gold/35 bg-ft-gold/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold"
                                : "rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300"
                            }
                          >
                            {headline.badge}
                          </span>
                        )}
                      </div>
                      {headline.helper && active ? (
                        <p className="hidden text-[11px] leading-snug text-neutral-500 md:block">
                          {headline.helper}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    <p className="text-sm font-semibold tabular-nums text-neutral-100">{formatCoins(winTotal)}</p>
                    <p className="hidden text-[11px] text-neutral-500 md:block">
                      {formatMultiple(odds.estMultiples[lane.id]?.WIN ?? null)}
                    </p>
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    <p className="text-sm font-semibold tabular-nums text-neutral-100">{formatCoins(placeTotal)}</p>
                    <p className="text-[11px] text-neutral-500 md:block hidden">
                      {formatMultiple(odds.estMultiples[lane.id]?.PLACE ?? null)}
                    </p>
                  </td>

                  <td className="px-3 py-2.5 align-middle">
                    <p className="text-sm font-semibold tabular-nums text-neutral-100">{formatCoins(showTotal)}</p>
                    <p className="hidden text-[11px] text-neutral-500 md:block">
                      {formatMultiple(odds.estMultiples[lane.id]?.SHOW ?? null)}
                    </p>
                  </td>
                  </tr>

                  {inlineSlipLaneId === lane.id && (
                    <tr className="bg-black/50">
                      <td colSpan={6} className="px-3 py-4 sm:px-4">
                        <div className="space-y-4 rounded-ft-lg border border-ft-gold/30 bg-gradient-to-b from-ft-charcoal/98 to-black/90 p-4 text-sm text-neutral-100 shadow-ft-card sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left transition hover:opacity-90"
                              onClick={() => setInlineSlipLaneId(null)}
                            >
                              <p className="ft-label text-neutral-500">Quick slip</p>
                              <p className="mt-1 truncate text-lg font-bold text-neutral-50">{playerLabel}</p>
                              <p className="mt-1 text-sm text-neutral-400">
                                WIN line{" "}
                                <span className="font-semibold tabular-nums text-ft-gold">{headline.label}</span>
                              </p>
                            </button>
                            <div className="flex items-start gap-2">
                              {headline.helper ? (
                                <p className="max-w-[14rem] text-xs leading-relaxed text-neutral-500">
                                  {headline.helper}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Close inline bet slip"
                                onClick={() => setInlineSlipLaneId(null)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:border-ft-gold/40 hover:text-ft-gold"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {!isLoggedIn ? (
                            <p className="text-sm text-neutral-400">
                              <Link href="/auth/login" className="font-semibold text-ft-gold underline-offset-4 hover:underline">
                                Log in
                              </Link>{" "}
                              to place bets.
                            </p>
                          ) : bettingClosed ? (
                            <p className="rounded-ft border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-neutral-400">
                              Betting is closed for this contest.
                            </p>
                          ) : !canBetByStatus ? (
                            <p className="text-xs text-neutral-400">Contest is not open for betting.</p>
                          ) : isScratched ? (
                            <p className="text-xs font-medium text-red-300">Scratched lanes cannot accept new wagers.</p>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {markets.map((market) => (
                                  <button
                                    key={market}
                                    type="button"
                                    onClick={() => setSelectedMarket(market)}
                                    className={
                                      "rounded-full border px-4 py-2 text-xs font-semibold transition duration-ft " +
                                      (selectedMarket === market
                                        ? "border-ft-gold/45 bg-ft-gold/12 text-ft-gold"
                                        : "border-white/10 bg-white/[0.04] text-neutral-400 hover:text-neutral-200")
                                    }
                                  >
                                    {market}
                                  </button>
                                ))}
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <input
                                  type="number"
                                  min={MIN_BET_AMOUNT}
                                  max={MAX_BET_AMOUNT}
                                  step={5}
                                  value={singleAmount}
                                  onChange={(event) => setSingleAmount(event.target.value)}
                                  className="min-h-11 w-full flex-1 rounded-ft border border-white/10 bg-black/50 px-3 py-2 text-xl font-bold tabular-nums text-neutral-50 sm:max-w-[10rem]"
                                  disabled={disableAllBetActions || isPending}
                                />
                                <button
                                  type="button"
                                  onClick={() => void placeSingleBet()}
                                  disabled={disableAllBetActions || isPending}
                                  className="ft-btn-primary min-h-11 w-full px-5 text-sm font-bold sm:w-auto"
                                >
                                  {bettingClosed
                                    ? "Betting closed"
                                    : selectedLaneIsScratched
                                    ? "Lane scratched"
                                    : `Place ${selectedMarket}`}
                                </button>
                              </div>

                              <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-end">
                                <input
                                  type="number"
                                  min={MIN_BET_AMOUNT}
                                  max={MAX_WPS_BET_AMOUNT}
                                  step={5}
                                  value={wpsAmount}
                                  onChange={(event) => setWpsAmount(event.target.value)}
                                  className="min-h-11 w-full flex-1 rounded-ft border border-white/10 bg-black/50 px-3 py-2 text-xl font-bold tabular-nums text-neutral-50 sm:max-w-[10rem]"
                                  disabled={disableAllBetActions || isPending}
                                />
                                <button
                                  type="button"
                                  onClick={() => void placeWpsBet()}
                                  disabled={disableAllBetActions || isPending}
                                  className="ft-btn-primary min-h-11 w-full px-5 text-sm font-bold sm:w-auto"
                                >
                                  Place WPS
                                </button>
                              </div>

                              <p className="text-[11px] leading-relaxed text-neutral-500">
                                Same rules as the main slip: min {formatCoins(MIN_BET_AMOUNT)}, $5 steps. WPS = 3×
                                charge ({formatCoins(Math.max(0, parsedWpsAmount || 0) * 3)} total at this amount).
                              </p>

                              {selectedMarket === Market.WIN &&
                              singleValid &&
                              selectedLaneId === lane.id &&
                              canBetByStatus &&
                              !bettingClosed &&
                              !selectedLaneIsScratched ? (
                                <div className="rounded-ft border border-ft-gold/20 bg-ft-gold/[0.05] p-3 text-[11px] text-neutral-300">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-neutral-200">Line impact</span>
                                    <OddsMoveInfoPopover />
                                  </div>
                                  <p className="mt-2 font-semibold tabular-nums text-neutral-100">
                                    Est. WIN multiple after bet ≈{" "}
                                    {projectedSingleWinMultiple === null
                                      ? "—"
                                      : `${projectedSingleWinMultiple.toFixed(2)}×`}
                                  </p>
                                  <p className="mt-1 text-neutral-500">Estimate only.</p>
                                </div>
                              ) : null}

                              {wpsValid &&
                              selectedLaneId === lane.id &&
                              canBetByStatus &&
                              !bettingClosed &&
                              !selectedLaneIsScratched ? (
                                <div className="rounded-ft border border-ft-gold/20 bg-ft-gold/[0.05] p-3 text-[11px] text-neutral-300">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-neutral-200">WIN pool impact</span>
                                    <OddsMoveInfoPopover />
                                  </div>
                                  <p className="mt-2 font-semibold tabular-nums text-neutral-100">
                                    Est. WIN multiple after WPS ≈{" "}
                                    {projectedWpsWinMultiple === null
                                      ? "—"
                                      : `${projectedWpsWinMultiple.toFixed(2)}×`}
                                  </p>
                                  <p className="mt-1 text-neutral-500">Estimate only.</p>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
        <span className="font-medium text-neutral-400">Note:</span> OPEN is the posted line when the WIN pool is empty.
        LIVE is the estimated WIN payout from the current pool (parimutuel — moves as others wager). Final WIN odds are
        fixed at lock.
      </p>

      <div className="flex gap-1 rounded-full border border-white/[0.08] bg-black/40 p-1 text-xs font-semibold text-neutral-400 shadow-inner md:hidden">
        <button
          type="button"
          onClick={() => setMobileBetTab("slip")}
          className={
            "flex-1 rounded-full px-3 py-2 transition duration-ft " +
            (mobileBetTab === "slip"
              ? "bg-ft-gold/15 text-ft-gold shadow-ft-inner"
              : "text-neutral-500 hover:text-neutral-300")
          }
        >
          Bet slip
        </button>
        <button
          type="button"
          onClick={() => setMobileBetTab("bets")}
          className={
            "flex-1 rounded-full px-3 py-2 transition duration-ft " +
            (mobileBetTab === "bets"
              ? "bg-ft-gold/15 text-ft-gold shadow-ft-inner"
              : "text-neutral-500 hover:text-neutral-300")
          }
        >
          My bets
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div
          className={
            "space-y-8 rounded-ft-lg border border-white/[0.09] bg-gradient-to-b from-black/40 to-black/20 p-6 shadow-ft-slip backdrop-blur-sm transition-all duration-300 ease-out hover:border-white/[0.14] sm:p-7 " +
            (mobileBetTab === "slip" ? "block" : "hidden") +
            " lg:sticky lg:top-24 lg:z-20 md:block"
          }
        >
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-neutral-50">Bet slip</h3>
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
                  : `Place ${selectedMarket}`}
              </button>
            </div>

            <p className="text-xs leading-relaxed text-neutral-500">
              Increments of $5. Max single bet {formatCoins(MAX_BET_AMOUNT)}.
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
                {bettingClosed ? "Betting closed" : selectedLaneIsScratched ? "Lane scratched" : "Place WPS"}
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

        <div
          className={
            "space-y-4 rounded-ft-lg border border-white/[0.08] bg-black/25 p-5 shadow-ft-card " +
            (mobileBetTab === "bets" ? "block" : "hidden") +
            " md:block"
          }
        >
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
    </section>
  );
}