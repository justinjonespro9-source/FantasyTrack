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
  /** Logged-in user's locked WIN multiple per lane (from ticket legs). Shown as "Locked Nx". */
  lockedMultipleByLaneId?: Record<string, number> | null;
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
      return "border-amber-400 bg-amber-500/10 text-amber-100";
    case 2:
      return "border-zinc-300 bg-zinc-500/25 text-zinc-50";
    case 3:
      return "border-orange-500 bg-orange-500/10 text-orange-100";
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

function formatLockedMultiple(multiple: number) {
  return Number.isInteger(multiple) ? `${multiple}x` : `${multiple.toFixed(1)}x`;
}

export function LiveRaceBoard({
  contestId: _contestId,
  title,
  lanes,
  sport,
  startTime,
  endTime,
  lockedMultipleByLaneId,
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
    <section className="rounded-2xl border border-amber-400/40 bg-neutral-950/90 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
            Live race board
          </p>
          <p className="text-xs text-neutral-400">
            {hasLiveData
              ? "Top runners ordered by current fantasy points."
              : "Live race view will update as fantasy points are recorded."}
          </p>
        </div>

        <div className="rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
          In-race view
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-50">Race Progress</span>
          <span className="text-neutral-400">{progressLabel}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
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

          <div className="relative h-4 rounded-full border border-neutral-800 bg-neutral-950/80">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-amber-400/80 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-amber-400 shadow z-10"
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
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 text-sm text-neutral-300">
          <p>
            No in-race fantasy data is available yet for <span className="font-semibold">{title}</span>. As
            fantasy points are updated, the live race board will show the leading runners and
            gaps.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
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
                    "flex flex-col gap-2 rounded-lg border px-3 py-2 transition-colors duration-300",
                    flash === "up" ? "rank-flash-up" : flash === "down" ? "rank-flash-down" : "",
                    rank === 1
                      ? "border-amber-400/80 bg-amber-500/15 shadow-[0_0_25px_rgba(251,191,36,0.3)]"
                      : rank === 2
                      ? "border-zinc-400/70 bg-neutral-900/80"
                      : rank === 3
                      ? "border-orange-500/70 bg-neutral-900/80"
                      : "border-neutral-800 bg-neutral-950/60",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex flex-col items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase leading-tight tracking-wide ${rankPillClass(
                        rank
                      )}`}
                    >
                      <span className="flex items-center gap-1">
                        P{rank}
                        <MovementIndicator movement={movement} delta={delta} />
                      </span>
                      <span className="text-[9px] font-normal opacity-80">{rankLabel(rank)}</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-neutral-50">
                          {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                        </p>
                        {lane.status !== "ACTIVE" && renderLaneStatusChip(lane.status) && (
                          <span className="inline-flex shrink-0">
                            {renderLaneStatusChip(lane.status)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Fantasy points:{" "}
                        <span className="font-semibold text-neutral-100">
                          {formatFantasyPoints(lane.fantasyPoints)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 text-right">
                      <div className="text-sm font-semibold text-neutral-50">
                        {formatFantasyPoints(lane.fantasyPoints)}
                        <span className="ml-1 text-[11px] font-normal text-neutral-400">pts</span>
                      </div>
                      {lockedMultipleByLaneId?.[lane.id] != null && (
                        <span
                          className="rounded border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                          title="Your locked WIN odds (pre-race)"
                        >
                          Locked {formatLockedMultiple(lockedMultipleByLaneId[lane.id])}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full bg-amber-400/80"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest of field */}
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-300">
              Rest of field
            </p>

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
                      "flex items-center justify-between rounded border border-neutral-800/70 bg-neutral-900/70 px-2 py-1 transition-colors duration-300",
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
                    <span className="shrink-0 text-xs font-semibold text-neutral-100">
                      {formatFantasyPoints(lane.fantasyPoints)}
                    </span>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

