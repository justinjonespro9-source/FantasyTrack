"use client";

import { useMemo, useState } from "react";
import {
  defaultAdminLaneSortKey,
  formatAdminLaneRank,
  sortLanesForAdminOdds,
  type AdminLaneSortKey,
} from "@/lib/admin/lane-sort";

export type AdminOddsLane = {
  id: string;
  name: string;
  team: string;
  position: string;
  openingWinOddsTo1: number | null;
  liveFantasyPoints: number | null;
  finalRank: number | null;
  status: string;
  seedRank: number | null;
  displayOrder: number | null;
  projectedPoints: number | null;
};

type Props = {
  contestId: string;
  lanes: AdminOddsLane[];
  updateLaneAction: (formData: FormData) => void | Promise<void>;
  setLaneStatusAction: (formData: FormData) => void | Promise<void>;
  scratchLaneAction: (formData: FormData) => void | Promise<void>;
};

function formatProjectedPoints(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

export default function AdminOddsLanes({
  contestId,
  lanes,
  updateLaneAction,
  setLaneStatusAction,
  scratchLaneAction,
}: Props) {
  const [sortKey, setSortKey] = useState<AdminLaneSortKey>(() =>
    defaultAdminLaneSortKey(lanes)
  );

  const sortedLanes = useMemo(
    () => sortLanesForAdminOdds(lanes, sortKey),
    [lanes, sortKey]
  );

  const hasRankings = lanes.some((l) => l.seedRank != null);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Lanes</p>
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor={`lane-sort-${contestId}`} className="text-track-500">
            Sort
          </label>
          <select
            id={`lane-sort-${contestId}`}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as AdminLaneSortKey)}
            className="rounded border border-track-200 bg-white px-2 py-1 text-track-800"
          >
            <option value="PROJECTED_RANK">Projected Rank</option>
            <option value="PROJECTED_POINTS">Projected Points</option>
            <option value="ALPHABETICAL">Alphabetical</option>
          </select>
        </div>
      </div>

      {hasRankings ? (
        <p className="mb-2 text-xs text-track-500">
          Ordered by imported ranking by default. Sort changes are display-only and do not
          change seed rank, display order, or saved odds.
        </p>
      ) : null}

      <div className="mb-1 hidden grid-cols-[3rem_minmax(0,1.4fr)_5rem_5.5rem_minmax(0,1fr)] gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-track-500 md:grid">
        <span>Rank</span>
        <span>Player</span>
        <span>Team</span>
        <span>Proj pts</span>
        <span>Pre-race odds</span>
      </div>

      <ul className="grid gap-2">
        {sortedLanes.map((lane) => {
          const rankLabel = formatAdminLaneRank(lane);
          return (
            <li key={lane.id} className="rounded border border-track-200 p-2">
              <form
                action={updateLaneAction}
                className="grid gap-2 md:grid-cols-[3rem_minmax(0,1.4fr)_5rem_5.5rem_minmax(0,1fr)_5.5rem_auto]"
              >
                <input type="hidden" name="laneId" value={lane.id} />
                <input type="hidden" name="contestId" value={contestId} />

                <div className="flex items-center">
                  <span className="text-[10px] font-semibold uppercase text-track-500 md:hidden">
                    Rank{" "}
                  </span>
                  <span className="font-semibold tabular-nums text-track-800">{rankLabel}</span>
                </div>

                <div className="grid gap-1">
                  <input name="name" defaultValue={lane.name} required aria-label="Player" />
                  <input
                    name="position"
                    defaultValue={lane.position}
                    placeholder="Pos"
                    aria-label="Position"
                    className="text-xs"
                  />
                </div>
                <input
                  name="team"
                  defaultValue={lane.team}
                  placeholder="Team"
                  aria-label="Team"
                />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase text-track-500 md:hidden">
                    Proj
                  </span>
                  <span className="tabular-nums text-track-700">
                    {formatProjectedPoints(lane.projectedPoints)}
                  </span>
                </div>
                <input
                  name="openingWinOddsTo1"
                  type="number"
                  min={0.1}
                  max={999}
                  step="0.1"
                  defaultValue={lane.openingWinOddsTo1 ?? ""}
                  placeholder="Opening WIN odds to-1"
                  aria-label="Pre-race odds"
                />
                <input
                  name="liveFantasyPoints"
                  type="number"
                  step="0.1"
                  defaultValue={lane.liveFantasyPoints ?? ""}
                  placeholder="Live points"
                  aria-label="Live fantasy points"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded bg-track-100 px-3 py-1 text-track-700"
                  >
                    Save lane
                  </button>
                  <span className="text-xs text-track-500">
                    {lane.finalRank ? `Final ${lane.finalRank}` : "No final rank"}
                  </span>
                </div>
              </form>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form action={setLaneStatusAction}>
                  <input type="hidden" name="contestId" value={contestId} />
                  <input type="hidden" name="laneId" value={lane.id} />
                  <input type="hidden" name="status" value="ACTIVE" />
                  <button
                    type="submit"
                    className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                  >
                    Active
                  </button>
                </form>

                <form action={setLaneStatusAction}>
                  <input type="hidden" name="contestId" value={contestId} />
                  <input type="hidden" name="laneId" value={lane.id} />
                  <input type="hidden" name="status" value="QUESTIONABLE" />
                  <button
                    type="submit"
                    className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                  >
                    Questionable
                  </button>
                </form>

                <form action={setLaneStatusAction}>
                  <input type="hidden" name="contestId" value={contestId} />
                  <input type="hidden" name="laneId" value={lane.id} />
                  <input type="hidden" name="status" value="DOUBTFUL" />
                  <button
                    type="submit"
                    className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                  >
                    Doubtful
                  </button>
                </form>

                <form action={scratchLaneAction}>
                  <input type="hidden" name="contestId" value={contestId} />
                  <input type="hidden" name="laneId" value={lane.id} />
                  <input type="hidden" name="note" value="SCRATCHED: admin" />
                  <button
                    type="submit"
                    className="rounded bg-track-800 px-3 py-1 text-xs text-white"
                    title="Mark scratched, void legs, refund bets"
                  >
                    Scratch (refund)
                  </button>
                </form>

                <span className="text-xs text-track-500">
                  Status: <span className="font-semibold">{lane.status ?? "ACTIVE"}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
