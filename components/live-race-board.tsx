"use client";

import { useMemo } from "react";

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
};

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

export function LiveRaceBoard({ contestId: _contestId, title, lanes }: LiveRaceBoardProps) {
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

  const leaderPoints =
    top4.length > 0 && top4[0].fantasyPoints != null ? top4[0].fantasyPoints! : null;

  const hasLiveData = lanesWithPoints.length > 0 && leaderPoints != null && leaderPoints > 0;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm">
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
          <div className="space-y-2 md:col-span-2">
            {top4.map((lane, idx) => {
              const rank = idx + 1;
              const pts = lane.fantasyPoints ?? 0;
              const ratio =
                leaderPoints && leaderPoints > 0 ? Math.max(0.05, Math.min(1, pts / leaderPoints)) : 0.05;

              return (
                <div
                  key={lane.id}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex flex-col rounded-full border px-2 py-1 text-[10px] font-semibold uppercase leading-tight tracking-wide ${rankPillClass(
                        rank
                      )}`}
                    >
                      <span>P{rank}</span>
                      <span className="text-[9px] font-normal opacity-80">{rankLabel(rank)}</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-50">
                        {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Fantasy points:{" "}
                        <span className="font-semibold text-neutral-100">
                          {formatFantasyPoints(lane.fantasyPoints)}
                        </span>
                      </p>
                    </div>

                    <div className="text-right text-sm font-semibold text-neutral-50">
                      {formatFantasyPoints(lane.fantasyPoints)}
                      <span className="ml-1 text-[11px] font-normal text-neutral-400">pts</span>
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
                  return (
                    <div
                      key={lane.id}
                      className="flex items-center justify-between rounded border border-neutral-800/70 bg-neutral-900/70 px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-neutral-400">P{rank}</span>
                        <span className="truncate text-xs text-neutral-200">
                          {formatLaneDisplayName(lane.name, lane.position, lane.team)}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-neutral-100">
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

