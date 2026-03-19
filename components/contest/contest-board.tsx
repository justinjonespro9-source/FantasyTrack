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
  /** WIN leg locked multiple (oddsTo1Snap + 1) for live race board display. */
  lockedMultiple?: number | null;
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
        className="rounded border border-track-300 px-1.5 py-0 text-xs text-track-700"
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
          className="absolute left-0 top-6 z-20 w-72 rounded border border-track-300 bg-white p-3 text-xs text-track-700 shadow-lg"
        >
          <p className="font-semibold text-track-900">Why do odds move?</p>
          <p className="mt-1">
            FantasyTrack uses a pool (parimutuel) system. As more money is wagered on a lane, its
            estimated payout decreases, and other lanes&apos; payouts increase.
          </p>
          <p className="mt-1 text-track-500">
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-track-900">{title}</div>
          <div className="text-xs text-track-600">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-track-900">{right}</div>
        </div>
      </div>
      {body ? <div className="mt-2 text-xs text-track-700">{body}</div> : null}
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

  /** Per-lane best locked WIN multiple for live race board (user's bets only). */
  const lockedMultipleByLaneId = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of myBets) {
      if (
        b.lockedMultiple != null &&
        Number.isFinite(b.lockedMultiple) &&
        !b.refunded
      ) {
        const existing = map.get(b.laneId);
        if (existing === undefined || b.lockedMultiple > existing) {
          map.set(b.laneId, b.lockedMultiple);
        }
      }
    }
    return Object.fromEntries(map);
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
    <section className="space-y-4 rounded-2xl border border-amber-400/40 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-amber-300 sm:text-xl">{title}</h2>
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 sm:text-xs">
            Starts{" "}
            <ClientOnly>
              <span>{formatDateTime(new Date(startTime))}</span>
            </ClientOnly>{" "}
            · Status: {status}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-neutral-700 bg-neutral-950/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-100">
              {sportLabel}
            </span>
            <span className="rounded-full border border-neutral-700 bg-neutral-950/80 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-100">
              Track Conditions: {trackConditionsLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm sm:justify-end">
          <ShareContestButton contestId={contestId} contestTitle={title} />
          <Link
            href="/how-to-play"
            className="rounded border border-neutral-700 bg-neutral-950/80 px-3 py-1.5 text-xs sm:text-sm text-neutral-200 hover:border-amber-300 hover:text-amber-200"
          >
            How to Play
          </Link>

          {!bettingClosed ? (
            <div className="rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1.5 text-xs text-neutral-100 sm:text-sm">
              <span className="hidden sm:inline">Lock countdown: </span>
              <span className="font-semibold text-amber-200">
                {formatCountdown(odds.timeToLockSeconds)}
              </span>
            </div>
          ) : (
            <div className="rounded-full border border-amber-400/70 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 sm:text-sm">
              Betting closed
            </div>
          )}
        </div>
      </div>

      {/* Live race board – overall leaderboard + integrated race progress */}
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
        lockedMultipleByLaneId={isLoggedIn ? lockedMultipleByLaneId : undefined}
        liveGameProgress={liveGameProgress ?? undefined}
        liveGameStatus={liveGameStatus ?? undefined}
      />

      {bettingClosed ? (
        <div className="rounded border border-amber-400/70 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="font-semibold">Betting is closed</div>
          <div className="text-amber-200">
            This contest has been locked and can no longer accept wagers.
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-50">Live odds board</p>
          <p className="text-xs text-neutral-400">
            Estimated payouts update until lock; final payouts determined at lock/settlement.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <label htmlFor="lane-sort" className="text-neutral-300">
            Sort by
          </label>
          <select
            id="lane-sort"
            value={sortKey}
            onChange={(event) => {
              const nextSort = event.target.value as LaneSortKey;
              setSortKey(nextSort);
            }}
            className="rounded border border-neutral-700 bg-neutral-950/80 px-2 py-1 text-neutral-100"
          >
            <option value="WIN_ODDS">Odds - High to Low</option>
            <option value="PLAYER">Player A-Z</option>
          </select>
        </div>
      </div>

      {isLoggedIn && (
        <div className="rounded border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-neutral-300">
              <span>
                Required: <span className="font-semibold text-neutral-100">{formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}</span>
              </span>
              <span>
                Wagered: <span className="font-semibold text-neutral-100">{formatCoins(coinsUsedInContest)}</span>
              </span>
              <span>
                Left to Allocate: <span className="font-semibold text-neutral-100">{formatCoins(odds.myCoinsRemainingInContest)}</span>
              </span>
            </div>
            {coinsUsedInContest >= REQUIRED_TOTAL_WAGER_PER_CONTEST && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                Allocation Complete
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-neutral-800">
        <div className="max-h-[30rem] overflow-y-auto">
          <table className="w-full table-auto text-left text-sm md:table-fixed md:min-w-[760px]">
          <colgroup>
            <col className="w-[110px]" />
            <col className="w-[220px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[64px]" />
          </colgroup>

          <thead className="sticky top-0 z-10 bg-neutral-900/95 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            <tr>
              <th className="px-2.5 py-1.5 text-left">Odds</th>
              <th className="px-2.5 py-1.5 text-left">Runner</th>
              <th className="px-2.5 py-1.5 text-left">
                WIN
                <div className="text-[11px] font-normal text-neutral-400">
                  {formatCoins(odds.poolTotals.WIN)}
                </div>
              </th>
              <th className="px-2.5 py-1.5 text-left">
                PLACE
                <div className="text-[11px] font-normal text-track-500">
                  {formatCoins(odds.poolTotals.PLACE)}
                </div>
              </th>
              <th className="px-2.5 py-1.5 text-left">
                SHOW
                <div className="text-[11px] font-normal text-track-500">
                  {formatCoins(odds.poolTotals.SHOW)}
                </div>
              </th>
              <th className="px-1.5 py-1.5 text-left"></th>
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
                active ? "bg-neutral-900/80 ring-1 ring-amber-400/80" : "hover:bg-neutral-900/60",
                isScratched ? "opacity-60 bg-red-950/40" : "",
                !isScratched && isDoubtful ? "bg-orange-950/30" : "",
                !isScratched && isQuestionable ? "bg-yellow-950/20" : "",
                "cursor-pointer text-neutral-100 transition-colors",
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
                    <td className="px-2 py-1.5 align-top">
                    <div className="flex items-start gap-1">
                      <div>
                        <div className="flex items-center gap-1">
                          <span
                            className={[
                              "font-semibold text-neutral-50 text-sm",
                              isScratched ? "text-neutral-500 line-through" : "",
                            ].join(" ")}
                          >
                            {headline.label}
                          </span>
                          {headline.badge && (
                            <span
                              className={
                                headline.badge === "LIVE"
                              ? "rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"
                                  : "rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200"
                              }
                            >
                              {headline.badge}
                            </span>
                          )}
                        </div>

                        {headline.helper && active ? (
                          <p className="mt-0.5 hidden text-[11px] text-track-500 md:block">
                            {headline.helper}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-2.5 py-1.5 align-top">
                    <div className="flex min-w-0 items-center gap-1">
                      <span
                        className={[
                          "block truncate text-sm font-medium text-neutral-50",
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

                  <td className="px-2.5 py-1.5 align-top">
                    <p className="text-sm font-semibold text-neutral-100">
                      {formatCoins(winTotal)}
                    </p>
                    <p className="hidden text-[11px] text-neutral-500 md:block">
                      {formatMultiple(odds.estMultiples[lane.id]?.WIN ?? null)}
                    </p>
                  </td>

                  <td className="px-2.5 py-1.5 align-top">
                    <p className="text-sm font-semibold text-neutral-100">
                      {formatCoins(placeTotal)}
                    </p>
                    <p className="text-[11px] text-neutral-500 md:block hidden">
                      {formatMultiple(odds.estMultiples[lane.id]?.PLACE ?? null)}
                    </p>
                  </td>

                  <td className="px-2.5 py-1.5 align-top">
                    <p className="text-sm font-semibold text-neutral-100">
                      {formatCoins(showTotal)}
                    </p>
                    <p className="hidden text-[11px] text-neutral-500 md:block">
                      {formatMultiple(odds.estMultiples[lane.id]?.SHOW ?? null)}
                    </p>
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <div className="flex flex-col items-start">
                      <span className="text-[11px] font-medium text-neutral-300">
                        {((lane.liveFantasyPoints ?? lane.fantasyPoints) ?? 0)
                          .toFixed(2)
                          .replace(/\.?0+$/, "")}{" "}
                        pts
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
                    </div>
                  </td>
                  </tr>

                  {inlineSlipLaneId === lane.id && (
                    <tr className="bg-neutral-950/95">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="space-y-2 rounded border border-neutral-800 bg-neutral-900/90 p-3 text-sm text-neutral-100">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left"
                              onClick={() => setInlineSlipLaneId(null)}
                            >
                              <div>
                                <p className="text-sm font-semibold text-neutral-50">{playerLabel}</p>
                                <p className="text-xs text-neutral-400">
                                  Current odds:{" "}
                                  <span className="font-semibold text-amber-200">
                                    {headline.label}
                                  </span>
                                </p>
                              </div>
                            </button>
                            <div className="flex items-start gap-2">
                              {headline.helper && (
                                <p className="max-w-xs text-xs text-neutral-500">{headline.helper}</p>
                              )}
                              <button
                                type="button"
                                aria-label="Close inline bet slip"
                                onClick={() => setInlineSlipLaneId(null)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950/80 text-xs text-neutral-400 hover:border-amber-400 hover:text-amber-300"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {!isLoggedIn ? (
                            <p className="text-xs text-neutral-300">
                              <Link href="/auth/login" className="underline">
                                Log in
                              </Link>{" "}
                              to place bets.
                            </p>
                          ) : bettingClosed ? (
                            <p className="text-xs text-amber-300">
                              Betting is closed for this contest.
                            </p>
                          ) : !canBetByStatus ? (
                            <p className="text-xs text-neutral-300">
                              Contest is not open for betting.
                            </p>
                          ) : isScratched ? (
                            <p className="text-xs text-red-200">
                              Scratched lanes cannot accept new wagers.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {markets.map((market) => (
                                  <button
                                    key={market}
                                    type="button"
                                    onClick={() => setSelectedMarket(market)}
                                    className={
                                      selectedMarket === market
                                        ? "border-amber-400 bg-amber-500/10 px-2 py-1 text-xs text-amber-100"
                                        : "border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                                    }
                                  >
                                    {market}
                                  </button>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  min={MIN_BET_AMOUNT}
                                  max={MAX_BET_AMOUNT}
                                  step={5}
                                  value={singleAmount}
                                  onChange={(event) => setSingleAmount(event.target.value)}
                                  className="w-28 rounded border border-neutral-700 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-100"
                                  disabled={disableAllBetActions || isPending}
                                />
                                <button
                                  type="button"
                                  onClick={() => void placeSingleBet()}
                                  disabled={disableAllBetActions || isPending}
                                  className="rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-300"
                                >
                                  {bettingClosed
                                    ? "Betting closed"
                                    : selectedLaneIsScratched
                                    ? "Lane scratched"
                                    : `Place ${selectedMarket}`}
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  min={MIN_BET_AMOUNT}
                                  max={MAX_WPS_BET_AMOUNT}
                                  step={5}
                                  value={wpsAmount}
                                  onChange={(event) => setWpsAmount(event.target.value)}
                                  className="w-28 rounded border border-neutral-700 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-100"
                                  disabled={disableAllBetActions || isPending}
                                />
                                <button
                                  type="button"
                                  onClick={() => void placeWpsBet()}
                                  disabled={disableAllBetActions || isPending}
                                  className="rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-300"
                                >
                                  WPS (WIN+PLACE+SHOW)
                                </button>
                              </div>

                              <p className="text-[11px] text-neutral-400">
                                Uses the same rules as the main bet slip: min{" "}
                                {formatCoins(MIN_BET_AMOUNT)} in $5 increments. WPS places 3 bets
                                (WIN, PLACE, SHOW) on this runner. Total cost = 3× your entered
                                amount — a $5 WPS costs $15.
                              </p>

                              {selectedMarket === Market.WIN &&
                              singleValid &&
                              selectedLaneId === lane.id &&
                              canBetByStatus &&
                              !bettingClosed &&
                              !selectedLaneIsScratched ? (
                                <div className="mt-1 rounded border border-neutral-800 bg-neutral-900/80 p-2 text-[11px] text-neutral-200">
                                  <div className="flex items-center gap-2">
                                    <p>Your wager will move the WIN line.</p>
                                    <OddsMoveInfoPopover />
                                  </div>
                                  <p>
                                    After this bet, est. WIN multiple ≈{" "}
                                    {projectedSingleWinMultiple === null
                                      ? "—"
                                      : `${projectedSingleWinMultiple.toFixed(2)}x`}
                                  </p>
                                  <p className="text-neutral-400">Estimate only; changes as others wager.</p>
                                </div>
                              ) : null}

                              {wpsValid &&
                              selectedLaneId === lane.id &&
                              canBetByStatus &&
                              !bettingClosed &&
                              !selectedLaneIsScratched ? (
                                <div className="mt-1 rounded border border-neutral-800 bg-neutral-900/80 p-2 text-[11px] text-neutral-200">
                                  <div className="flex items-center gap-2">
                                    <p>Your WPS wager will move the WIN pool.</p>
                                    <OddsMoveInfoPopover />
                                  </div>
                                  <p>
                                    After this WPS bet, est. WIN multiple ≈{" "}
                                    {projectedWpsWinMultiple === null
                                      ? "—"
                                      : `${projectedWpsWinMultiple.toFixed(2)}x`}
                                  </p>
                                  <p className="text-neutral-400">Estimate only; changes as others wager.</p>
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

      <p className="text-xs text-neutral-400">
        OPEN = opening estimate (no pool yet). LIVE = crowd-priced based on the current pool. Your wager
        will move the number.
      </p>

      <div className="mt-4 flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1 text-xs font-semibold text-neutral-300 md:hidden">
        <button
          type="button"
          onClick={() => setMobileBetTab("slip")}
          className={
            "flex-1 rounded-md px-3 py-1 " +
            (mobileBetTab === "slip"
              ? "bg-neutral-800 text-amber-200"
              : "bg-transparent text-neutral-300")
          }
        >
          Bet Slip
        </button>
        <button
          type="button"
          onClick={() => setMobileBetTab("bets")}
          className={
            "flex-1 rounded-md px-3 py-1 " +
            (mobileBetTab === "bets"
              ? "bg-neutral-800 text-amber-200"
              : "bg-transparent text-neutral-300")
          }
        >
          My Bets
        </button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div
          className={
            "space-y-3 rounded-lg border border-neutral-800/70 bg-neutral-900/70 p-4 " +
            (mobileBetTab === "slip" ? "block" : "hidden") +
            " md:block"
          }
        >
          <h3 className="text-sm font-semibold text-neutral-50">Bet Slip</h3>

          <div className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-3 text-sm text-neutral-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Wagered:{" "}
                <span className="font-semibold text-neutral-50">
                  {formatCoins(coinsUsedInContest)} / {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)}
                </span>
              </p>
              <p>
                Left to allocate:{" "}
                <span className="font-semibold text-neutral-50">
                  {formatCoins(odds.myCoinsRemainingInContest)}
                </span>
              </p>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-amber-400/80 transition-all"
                style={{ width: `${allocationProgress}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
              <p>Min bet: {formatCoins(MIN_BET_AMOUNT)}</p>
              <p>Single max: {formatCoins(MAX_BET_AMOUNT)}</p>
              <p>WPS max: {formatCoins(MAX_WPS_BET_AMOUNT)} per leg</p>
            </div>

            <p className="mt-2 text-xs text-neutral-400">
              Contest allocation target: {formatCoins(REQUIRED_TOTAL_WAGER_PER_CONTEST)} total.
            </p>
          </div>

          {selectedLaneIsScratched ? (
            <div className="rounded border border-red-400/70 bg-red-950/40 p-3 text-sm text-neutral-100">
              <p className="font-semibold text-red-200">Selected lane scratched</p>
              <p className="mt-1">
                Scratched lanes remain visible but cannot accept new wagers. Existing wagers on a scratched
                lane are voided and refunded.
              </p>
            </div>
          ) : null}

          {isMaxedOut ? (
            <p className="text-sm text-amber-300">You are maxed out for this contest.</p>
          ) : null}

          {!isLoggedIn ? (
            <p className="text-sm text-neutral-300">
              <Link href="/auth/login" className="underline">
                Log in
              </Link>{" "}
              to place bets.
            </p>
          ) : null}

          {bettingClosed ? (
            <p className="text-sm text-amber-300">Betting is closed for this contest.</p>
          ) : !canBetByStatus ? (
            <p className="text-sm text-neutral-300">Contest is not open for betting.</p>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-100">Selected lane</label>
            <select
              value={selectedLaneId}
              onChange={(event) => setSelectedLaneId(event.target.value)}
              className="w-full"
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
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="mb-2 text-sm font-semibold text-neutral-50">
              Single Bet ({selectedMarket})
            </p>

            <div className="mb-2 flex flex-wrap gap-2">
              {markets.map((market) => (
                <button
                  key={market}
                  type="button"
                  onClick={() => setSelectedMarket(market)}
                  className={
                    selectedMarket === market
                      ? "border-amber-400 bg-amber-500/10 px-3 py-1 text-amber-100"
                      : "border-neutral-700 bg-neutral-900 px-3 py-1 text-neutral-200"
                  }
                >
                  {market}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={MIN_BET_AMOUNT}
                max={MAX_BET_AMOUNT}
                step={5}
                value={singleAmount}
                onChange={(event) => setSingleAmount(event.target.value)}
                className="w-36"
                disabled={disableAllBetActions || isPending}
              />
              <button
                type="button"
                onClick={() => void placeSingleBet()}
                disabled={disableAllBetActions || isPending}
                className="bg-amber-400 px-3 py-2 text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {bettingClosed
                  ? "Betting closed"
                  : selectedLaneIsScratched
                  ? "Lane scratched"
                  : `Place ${selectedMarket}`}
              </button>
            </div>

            <p className="mt-1 text-xs text-neutral-400">
              Single bets must be in increments of $5. Max single bet: {formatCoins(MAX_BET_AMOUNT)}.
            </p>

            {singleTooSmall ? (
              <p className="mt-1 text-sm text-red-600">Minimum bet is {formatCoins(MIN_BET_AMOUNT)}.</p>
            ) : null}
            {singleNotIncrement ? (
              <p className="mt-1 text-sm text-red-600">Bets must be in increments of $5.</p>
            ) : null}
            {singleTooLarge ? (
              <p className="mt-1 text-sm text-red-600">
                Maximum single bet is {formatCoins(MAX_BET_AMOUNT)}.
              </p>
            ) : null}

            <div className="mt-3 rounded border border-neutral-800 bg-neutral-900/80 p-2 text-xs text-neutral-200">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Bet summary
              </h4>
              <dl className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Runner</dt>
                  <dd className="max-w-[11rem] truncate text-right font-medium">
                    {selectedLane ? selectedRunnerLabel : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Market</dt>
                  <dd className="text-right font-medium">
                    {selectedMarket ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-400">Wager</dt>
                  <dd className="text-right font-medium">
                    {Number.isFinite(parsedSingleAmount) && parsedSingleAmount > 0
                      ? formatCoins(parsedSingleAmount)
                      : "—"}
                  </dd>
                </div>
                {selectedMarket === Market.WIN && projectedSingleWinMultiple !== null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-400">Projected WIN multiple</dt>
                    <dd className="text-right font-medium">
                      ×{projectedSingleWinMultiple.toFixed(2)}
                    </dd>
                  </div>
                )}
                {selectedMarket === Market.WIN &&
                  projectedSingleWinMultiple !== null &&
                  Number.isFinite(parsedSingleAmount) &&
                  parsedSingleAmount > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-400">Est. payout</dt>
                      <dd className="text-right font-medium">
                        {formatCoins(parsedSingleAmount * projectedSingleWinMultiple)}
                      </dd>
                    </div>
                  )}
              </dl>
              <p className="mt-1 text-[11px] text-neutral-400">
                Placing this bet may move the live odds and payout multiples, especially in thin markets.
              </p>
            </div>

            {selectedMarket === Market.WIN &&
            singleValid &&
            selectedLaneId &&
            canBetByStatus &&
            !bettingClosed &&
            !selectedLaneIsScratched ? (
              <div className="mt-2 rounded border border-neutral-800 bg-neutral-900/80 p-2 text-xs text-neutral-200">
                <div className="flex items-center gap-2">
                  <p>Your wager will move the line.</p>
                  <OddsMoveInfoPopover />
                </div>
                <p>
                  After this bet, est. WIN multiple ≈{" "}
                  {projectedSingleWinMultiple === null ? "—" : `${projectedSingleWinMultiple.toFixed(2)}x`}
                </p>
                <p className="text-neutral-400">Estimate only; changes as others wager.</p>
              </div>
            ) : null}
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="mb-2 text-sm font-semibold text-neutral-50">
              WPS (WIN + PLACE + SHOW)
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={MIN_BET_AMOUNT}
                max={MAX_WPS_BET_AMOUNT}
                step={5}
                value={wpsAmount}
                onChange={(event) => setWpsAmount(event.target.value)}
                className="w-36"
                disabled={disableAllBetActions || isPending}
              />
              <button
                type="button"
                onClick={() => void placeWpsBet()}
                disabled={disableAllBetActions || isPending}
                className="bg-amber-400 px-3 py-2 text-neutral-950 disabled:bg-neutral-700 disabled:text-neutral-300"
              >
                {bettingClosed ? "Betting closed" : selectedLaneIsScratched ? "Lane scratched" : "Place WPS"}
              </button>
            </div>

            <p className="mt-1 text-xs text-neutral-400">
              WPS places 3 bets (WIN + PLACE + SHOW). Amount must be in increments of $5. Max WPS amount:{" "}
              {formatCoins(MAX_WPS_BET_AMOUNT)} per leg.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Total wager = 3 x amount = {formatCoins(Math.max(0, parsedWpsAmount || 0) * 3)}
            </p>

            {wpsTooSmall ? (
              <p className="mt-1 text-sm text-red-600">
                Minimum WPS leg amount is {formatCoins(MIN_BET_AMOUNT)}.
              </p>
            ) : null}
            {wpsNotIncrement ? (
              <p className="mt-1 text-sm text-red-600">WPS amount must be in increments of $5.</p>
            ) : null}
            {wpsTooLarge ? (
              <p className="mt-1 text-sm text-red-600">
                Maximum WPS amount is {formatCoins(MAX_WPS_BET_AMOUNT)} per leg.
              </p>
            ) : null}

            {wpsValid && selectedLaneId && canBetByStatus && !bettingClosed && !selectedLaneIsScratched ? (
              <div className="mt-2 rounded border border-neutral-800 bg-neutral-900/80 p-2 text-xs text-neutral-200">
                <div className="flex items-center gap-2">
                  <p>Your wager will move the line.</p>
                  <OddsMoveInfoPopover />
                </div>
                <p>
                  After this bet, est. WIN multiple ≈{" "}
                  {projectedWpsWinMultiple === null ? "—" : `${projectedWpsWinMultiple.toFixed(2)}x`}
                </p>
                <p className="text-neutral-400">Estimate only; changes as others wager.</p>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </div>

        <div
          className={
            "space-y-3 rounded-lg border border-neutral-800/70 bg-neutral-900/70 p-4 " +
            (mobileBetTab === "bets" ? "block" : "hidden") +
            " md:block"
          }
        >
          <div>
            <h3 className="font-semibold text-neutral-50">My Bets &amp; Payouts</h3>
            <p className="text-xs text-neutral-400">
              Tickets are grouped by lane so all wagers for a player stay together.
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
        <div className="rounded-xl border border-track-300 bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-track-900">Final results</p>
            <span className="rounded-full border border-track-300 bg-track-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-track-700">
              Settled
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {lanes
              .filter((lane) => lane.finalRank !== null)
              .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999))
              .map((lane) => {
                const rank = lane.finalRank ?? 999;
                const isGold = rank === 1;
                const isSilver = rank === 2;
                const isBronze = rank === 3;

                const rowClass = isGold
                  ? "border-2 border-yellow-400 bg-yellow-100"
                  : isSilver
                  ? "border-2 border-slate-400 bg-slate-100"
                  : isBronze
                  ? "border-2 border-amber-500 bg-amber-100"
                  : "border border-track-200 bg-track-50";

                const badgeClass = isGold
                  ? "border-yellow-500 bg-yellow-200 text-yellow-900"
                  : isSilver
                  ? "border-slate-500 bg-slate-200 text-slate-900"
                  : isBronze
                  ? "border-amber-600 bg-amber-200 text-amber-900"
                  : "border-track-300 bg-white text-track-700";

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
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2.5 ${rowClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClass}`}
                      >
                        {medalLabel}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-track-900">{lane.name}</span>
                          {isGold ? (
                            <span className="rounded bg-yellow-200 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-900">
                              Gold
                            </span>
                          ) : isSilver ? (
                            <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-900">
                              Silver
                            </span>
                          ) : isBronze ? (
                            <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                              Bronze
                            </span>
                          ) : null}
                        </div>

                        <div className="text-xs text-track-600">
                          {lane.team} · {lane.position}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-track-500">
                        Fantasy points
                      </div>
                      <div className="font-semibold text-track-900">
                        {lane.fantasyPoints !== null ? lane.fantasyPoints : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}