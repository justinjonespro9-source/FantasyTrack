"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LaneStatus = "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "SCRATCHED";

type LiveRaceLane = {
  id: string;
  name: string;
  team: string | null;
  position: string | null;
  fantasyPoints: number | null;
  status: LaneStatus;
};

type LiveRaceBoardProps = {
  contestId: string;
  title: string;
  lanes: LiveRaceLane[];
  sport?: string | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  /** Lanes where the logged-in user has a non-refunded wager (any market). Neutral highlight only. */
  userPickLaneIds?: Record<string, boolean> | null;
  /** From live BoxScore pull (0–100). When set, progress bar uses this instead of time. */
  liveGameProgress?: number | null;
  /** From live BoxScore pull (e.g. InProgress, Final). Used for progress label when present. */
  liveGameStatus?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRaceProgressPercent(startTime?: string | Date | null, endTime?: string | Date | null) {
  if (!startTime || !endTime) return 0;

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const now = Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;

  return clamp(((now - start) / (end - start)) * 100, 0, 100);
}

function formatRaceProgressText(
  progressPercent: number,
  liveGameStatus?: string | null
) {
  if (liveGameStatus != null && liveGameStatus.trim() !== "") {
    const s = liveGameStatus.trim();
    if (s.toLowerCase() === "final" || s.toLowerCase() === "f/ot") return "Final";
    if (s.toLowerCase() === "inprogress") return `${Math.round(progressPercent)}% of game`;
  }
  if (progressPercent <= 0) return "Not started";
  if (progressPercent >= 100) return "Finish line";
  return `${Math.round(progressPercent)}% of race`;
}

function getSportSegments(sport?: string | null): string[] {
  const key = (sport ?? "").toUpperCase();

  if (key.includes("HOCKEY")) {
    return ["Start", "End 1st", "End 2nd", "Final"];
  }

  if (key.includes("BASKETBALL") || key.includes("NBA")) {
    return ["Start", "Halftime", "End 3rd", "Final"];
  }

  if (key.includes("FOOTBALL") || key.includes("NFL")) {
    return ["Start", "Halftime", "End 3rd", "Final"];
  }

  if (key.includes("BASEBALL") || key.includes("MLB")) {
    return ["Start", "Mid Game", "Late Game", "Final"];
  }

  // Generic fallback
  return ["Start", "Mid Game", "Late", "Final"];
}

function formatLaneDisplayName(name: string, position?: string | null, team?: string | null) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const shortName =
    parts.length <= 1 ? name : `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;

  if (position && team) return `${shortName} (${position}) ${team}`;
  if (position) return `${shortName} (${position})`;
  if (team) return `${shortName} ${team}`;
  return shortName;
}

function formatFantasyPoints(value: number | null) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function renderLaneStatusChip(status: LaneStatus) {
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

function rankLabel(rank: number) {
  switch (rank) {
    case 1:
      return "Leader";
    case 2:
      return "Chasing";
    case 3:
      return "In the mix";
    case 4:
      return "On the bubble";
    default:
      return `P${rank}`;
  }
}

function rankPillClass(rank: number) {
  switch (rank) {
    case 1:
      return "border-ft-gold/60 bg-gradient-to-b from-ft-gold/20 to-ft-gold/5 text-ft-gold shadow-[0_0_20px_rgba(212,175,55,0.15)]";
    case 2:
      return "border-white/25 bg-gradient-to-b from-white/12 to-white/[0.04] text-neutral-100";
    case 3:
      return "border-orange-400/45 bg-gradient-to-b from-orange-500/15 to-orange-950/30 text-orange-100";
    case 4:
      return "border-zinc-700 bg-zinc-900/80 text-zinc-100";
    default:
      return "border-zinc-800 bg-zinc-900 text-zinc-200";
  }
}

type Movement = "up" | "down" | "unchanged";

function getMovement(previousRank: number | undefined, currentRank: number): { movement: Movement; delta: number } {
  if (previousRank === undefined) return { movement: "unchanged", delta: 0 };
  if (previousRank === currentRank) return { movement: "unchanged", delta: 0 };
  if (currentRank < previousRank) return { movement: "up", delta: previousRank - currentRank };
  return { movement: "down", delta: currentRank - previousRank };
}

function MovementIndicator({ movement, delta }: { movement: Movement; delta: number }) {
  if (movement === "unchanged") {
    return <span className="text-[10px] font-medium text-neutral-500">—</span>;
  }
  if (movement === "up") {
    return (
      <span className="text-[10px] font-semibold text-emerald-400" aria-label={`Up ${delta}`}>
        ▲{delta}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-red-400" aria-label={`Down ${delta}`}>
      ▼{delta}
    </span>
  );
}

const HIGHLIGHT_DURATION_MS = 1500;

export function LiveRaceBoard({
  contestId: _contestId,
  title,
  lanes,
  sport,
  startTime,
  endTime,
  userPickLaneIds,
  liveGameProgress,
  liveGameStatus,
}: LiveRaceBoardProps) {
  const previousRankByLaneId = useRef<Record<string, number>>({});
  const [highlightByLaneId, setHighlightByLaneId] = useState<Record<string, "up" | "down">>({});
  const highlightTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const lanesWithPoints = useMemo(
    () =>
      lanes.filter((lane) => lane.fantasyPoints != null && Number.isFinite(lane.fantasyPoints)),
    [lanes]
  );

  const sorted = useMemo(() => {
    const byPoints = [...lanes].sort((a, b) => {
      const aPts = a.fantasyPoints ?? -Infinity;
      const bPts = b.fantasyPoints ?? -Infinity;
      if (aPts !== bPts) return bPts - aPts;
      return a.name.localeCompare(b.name);
    });
    return byPoints;
  }, [lanes]);

  const top4 = useMemo(() => sorted.slice(0, 4), [sorted]);
  const rest = useMemo(() => sorted.slice(4), [sorted]);

  // After sort changes: update previous-rank ref, trigger highlight for movers, clear highlights after delay
  useEffect(() => {
    const currentRankByLaneId: Record<string, number> = {};
    sorted.forEach((lane, idx) => {
      currentRankByLaneId[lane.id] = idx + 1;
    });

    const prev = previousRankByLaneId.current;
    const nextHighlight: Record<string, "up" | "down"> = {};

    for (const lane of sorted) {
      const laneId = lane.id;
      const curr = currentRankByLaneId[laneId];
      const previousRank = prev[laneId];
      if (previousRank !== undefined && previousRank !== curr) {
        nextHighlight[laneId] = curr < previousRank ? "up" : "down";
      }
    }

    previousRankByLaneId.current = currentRankByLaneId;

    if (Object.keys(nextHighlight).length > 0) {
      setHighlightByLaneId((h) => ({ ...h, ...nextHighlight }));

      highlightTimeouts.current.forEach((t) => clearTimeout(t));
      highlightTimeouts.current = [
        setTimeout(() => {
          setHighlightByLaneId((h) => {
            const out = { ...h };
            for (const id of Object.keys(nextHighlight)) delete out[id];
            return out;
          });
          highlightTimeouts.current = [];
        }, HIGHLIGHT_DURATION_MS),
      ];
    }

    return () => highlightTimeouts.current.forEach((t) => clearTimeout(t));
  }, [sorted]);

  const leaderPoints =
    top4.length > 0 && top4[0].fantasyPoints != null ? top4[0].fantasyPoints! : null;

  const hasLiveData = lanesWithPoints.length > 0 && leaderPoints != null && leaderPoints > 0;

  const timeBasedProgress = getRaceProgressPercent(startTime, endTime);
  const progressPercent =
    liveGameProgress != null && Number.isFinite(liveGameProgress)
      ? clamp(liveGameProgress, 0, 100)
      : timeBasedProgress;
  const progressLabel = formatRaceProgressText(progressPercent, liveGameStatus);
  const segments = getSportSegments(sport);

  return (
    <section
      className="relative overflow-hidden rounded-ft-lg border border-white/[0.09] bg-ft-gradient-panel p-5 shadow-ft-card backdrop-blur-sm sm:p-6"
      aria-label="Live race standings and event progress"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_-40%,rgba(212,175,55,0.12),transparent_55%)]" />
      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ft-label text-ft-gold">Standings</p>
          <p className="mt-2 text-lg font-bold tracking-tight text-neutral-50 sm:text-xl">Live race board</p>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-500">
            {hasLiveData
              ? "Fantasy points drive the order. Watch rank flashes when positions change."
              : "Standings fill in as fantasy points post."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ft-gold/40 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ft-gold" />
          </span>
          <div className="rounded-full border border-ft-gold/30 bg-ft-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-ft-gold shadow-ft-inner">
            Live
          </div>
        </div>
      </div>

      <div className="relative space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-neutral-200">Event progress</span>
          <span className="text-xs font-medium tabular-nums text-neutral-500">{progressLabel}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            {segments.map((label, idx) => (
              <span
                key={label}
                className={
                  idx === 0
                    ? "flex-1 text-left"
                    : idx === segments.length - 1
                    ? "flex-1 text-right"
                    : "flex-1 text-center"
                }
              >
                {label}
              </span>
            ))}
          </div>

          <div className="relative h-3 overflow-hidden rounded-full border border-white/[0.08] bg-black/50 shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ft-gold-dim via-ft-gold to-ft-gold-bright transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white/90 bg-ft-gold shadow-[0_0_12px_rgba(212,175,55,0.5)]"
              style={{
                left:
                  progressPercent <= 0
                    ? "4px"
                    : progressPercent >= 100
                    ? "calc(100% - 20px)"
                    : `calc(${progressPercent}% - 11px)`,
              }}
            />
          </div>
        </div>
      </div>

      {!hasLiveData ? (
        <div className="relative rounded-ft border border-white/[0.06] bg-black/30 p-5 text-sm leading-relaxed text-neutral-400">
          <p>
            No in-race fantasy data yet for <span className="font-semibold text-neutral-200">{title}</span>.
            Standings and gaps appear once points are posted.
          </p>
        </div>
      ) : (
        <>
        {/* Desktop / tablet: existing hero + rest-of-field grid */}
        <div className="relative hidden md:grid md:grid-cols-3 md:gap-5">
          {/* Top 4 hero */}
          <div className="space-y-3 md:col-span-2">
            {top4.map((lane, idx) => {
              const rank = idx + 1;
              const pts = lane.fantasyPoints ?? 0;
              const ratio =
                leaderPoints && leaderPoints > 0 ? Math.max(0.05, Math.min(1, pts / leaderPoints)) : 0.05;
              const { movement, delta } = getMovement(previousRankByLaneId.current[lane.id], rank);
              const flash = highlightByLaneId[lane.id];

              return (
                <div
                  key={lane.id}
                  className={[
                    "group flex flex-col gap-3 rounded-ft-lg border px-4 py-3 transition-all duration-300 sm:py-3.5",
                    flash === "up" ? "rank-flash-up" : flash === "down" ? "rank-flash-down" : "",
                    rank === 1
                      ? "animate-ft-leader-pulse border-ft-gold/50 bg-gradient-to-br from-ft-gold/[0.14] via-neutral-900/95 to-black/90 shadow-ft-glow-gold"
                      : rank === 2
                      ? "border-white/15 bg-gradient-to-br from-white/[0.07] to-black/50 hover:border-white/25"
                      : rank === 3
                      ? "border-orange-500/25 bg-gradient-to-br from-orange-950/40 to-black/60 hover:border-orange-400/35"
                      : "border-white/[0.06] bg-black/45 hover:border-white/12",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span
                      className={`inline-flex min-w-[3.25rem] flex-col items-center justify-center rounded-ft border px-2 py-2 text-[10px] font-bold uppercase leading-tight tracking-wide ${rankPillClass(
                        rank
                      )}`}
                    >
                      <span className="flex items-center gap-1 tabular-nums">
                        {rank <= 3 ? (rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd") : `P${rank}`}
                        <MovementIndicator movement={movement} delta={delta} />
                      </span>
                      <span className="mt-0.5 text-[9px] font-medium opacity-80">{rankLabel(rank)}</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate tracking-tight text-neutral-50 ${rank <= 3 ? "text-base font-bold sm:text-lg" : "text-sm font-semibold"}`}
                        >
                          {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                        </p>
                        {lane.status !== "ACTIVE" && renderLaneStatusChip(lane.status) && (
                          <span className="inline-flex shrink-0">
                            {renderLaneStatusChip(lane.status)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Fantasy points <span className="text-neutral-600">·</span> live scoring
                      </p>
                    </div>

                    <div className="flex flex-col items-end justify-center text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        FP
                      </span>
                      <div
                        className={`tabular-nums tracking-tight text-neutral-50 ${rank <= 3 ? "text-2xl font-bold sm:text-[1.65rem]" : "text-lg font-semibold"}`}
                      >
                        {formatFantasyPoints(lane.fantasyPoints)}
                      </div>
                      {userPickLaneIds?.[lane.id] ? (
                        <span
                          className="mt-1 rounded-full border border-ft-gold/35 bg-ft-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ft-gold"
                          title="You have a wager on this lane. WIN payouts are pool-priced at lock — we do not store a personal locked price per bet unless shown as locked final odds."
                        >
                          Your pick
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="h-1 w-full overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ft-gold-dim to-ft-gold transition-all duration-500 ease-out"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest of field */}
                  <div className="rounded-ft border border-white/[0.06] bg-black/35 p-3 shadow-inner">
            <p className="mb-2 ft-label text-neutral-500">Rest of field</p>

            {rest.length === 0 ? (
              <p className="text-sm text-neutral-400">Only four runners with fantasy points so far.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {rest.map((lane, idx) => {
                  const rank = idx + 5;
                  const { movement, delta } = getMovement(previousRankByLaneId.current[lane.id], rank);
                  const flash = highlightByLaneId[lane.id];
                  return (
                  <div
                    key={lane.id}
                    className={[
                      "flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]",
                      flash === "up" ? "rank-flash-up" : flash === "down" ? "rank-flash-down" : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-neutral-400">
                        P{rank}
                        <MovementIndicator movement={movement} delta={delta} />
                      </span>
                      <span className="truncate text-xs text-neutral-200">
                        {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                      </span>
                      {lane.status !== "ACTIVE" && renderLaneStatusChip(lane.status) && (
                        <span className="inline-flex shrink-0">
                          {renderLaneStatusChip(lane.status)}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {userPickLaneIds?.[lane.id] ? (
                        <span
                          className="rounded-full border border-ft-gold/30 bg-ft-gold/10 px-1.5 py-0.5 text-[9px] font-semibold text-ft-gold"
                          title="You have a wager on this lane. WIN payouts are pool-priced at lock — we do not store a personal locked price per bet unless shown as locked final odds."
                        >
                          Your pick
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold text-neutral-100">
                        {formatFantasyPoints(lane.fantasyPoints)}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: full-field stacked list — no horizontal clipping */}
        <div className="space-y-2 md:hidden">
          {sorted.map((lane, idx) => {
            const rank = idx + 1;
            const lanePts = lane.fantasyPoints ?? 0;
            const ratio =
              leaderPoints && leaderPoints > 0
                ? Math.max(0.05, Math.min(1, lanePts / leaderPoints))
                : 0.05;
            const { movement, delta } = getMovement(previousRankByLaneId.current[lane.id], rank);
            const flash = highlightByLaneId[lane.id];

            return (
              <div
                key={lane.id}
                className={[
                  "overflow-hidden rounded-ft border px-3 py-2.5 transition-all duration-300",
                  flash === "up" ? "rank-flash-up" : flash === "down" ? "rank-flash-down" : "",
                  rank === 1
                    ? "border-ft-gold/40 bg-black/50"
                    : "border-white/[0.08] bg-black/35",
                ].join(" ")}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`inline-flex min-w-[2.5rem] flex-col items-center justify-center rounded border px-1 py-1 text-[9px] font-bold uppercase leading-tight tracking-wide ${rankPillClass(rank)}`}
                  >
                    <span className="flex items-center gap-0.5 tabular-nums">
                      {rank <= 3 ? (rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd") : `P${rank}`}
                      <MovementIndicator movement={movement} delta={delta} />
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-neutral-100">
                      {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {lane.status !== "ACTIVE" ? (
                        <span className="inline-flex shrink-0">{renderLaneStatusChip(lane.status)}</span>
                      ) : null}
                      <span className="text-[10px] text-neutral-500">
                        {rankLabel(rank)}
                        {userPickLaneIds?.[lane.id] ? (
                          <span className="ml-1.5 text-ft-gold/90">· Your pick</span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">FP</p>
                    <p className="text-lg font-bold tabular-nums text-neutral-50">
                      {formatFantasyPoints(lane.fantasyPoints)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-900">
                  <div
                    className="h-full rounded-full bg-neutral-500 transition-all duration-500 ease-out"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-neutral-600">
                  Bar vs leader ({formatFantasyPoints(lane.fantasyPoints)} /{" "}
                  {leaderPoints != null ? formatFantasyPoints(leaderPoints) : "—"})
                </p>
              </div>
            );
          })}
        </div>
        </>
      )}
    </section>
  );
}

