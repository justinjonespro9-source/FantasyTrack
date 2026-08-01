"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCoins } from "@/lib/format";
import {
  formatContestLifecycleLabel,
  formatScoringLabel,
  formatSlateLabel,
} from "@/lib/contest-presentation";

export type FieldReviewLane = {
  id: string;
  name: string;
  team: string;
  opponent: string | null;
  position: string;
  depthRole: string | null;
  seedRank: number | null;
  displayOrder: number | null;
  projectedPoints: number | null;
  notes: string | null;
  status: string;
  poolAmount: number;
  entryCount: number;
  currentOddsLabel: string;
};

export type FieldReviewContest = {
  id: string;
  title: string;
  status: string;
  sport: string;
  season: number | null;
  week: number | null;
  scoringFormat: string | null;
  slate: string | null;
  startTime: string;
  positionHint: string | null;
};

type Props = {
  contest: FieldReviewContest;
  initialLanes: FieldReviewLane[];
  poolTotal: number;
  entryCount: number;
};

export default function ContestFieldReview({
  contest,
  initialLanes,
  poolTotal,
  entryCount,
}: Props) {
  const [lanes, setLanes] = useState(initialLanes);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const teams = useMemo(() => new Set(lanes.map((l) => l.team).filter(Boolean)).size, [lanes]);
  const position = contest.positionHint || lanes[0]?.position || "—";

  async function patch(body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/contest-field", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contestId: contest.id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Update failed");
      return false;
    }
    setMessage("Field updated");
    return true;
  }

  async function saveLane(lane: FieldReviewLane) {
    setBusyId(lane.id);
    const ok = await patch({
      action: "update",
      laneId: lane.id,
      name: lane.name,
      team: lane.team,
      opponent: lane.opponent,
      position: lane.position,
      depthRole: lane.depthRole,
      seedRank: lane.seedRank,
      projectedPoints: lane.projectedPoints,
      notes: lane.notes,
    });
    setBusyId(null);
    if (ok) setMessage(`Saved ${lane.name}`);
  }

  async function removeLane(laneId: string) {
    if (!window.confirm("Remove this runner from the field before publish?")) return;
    setBusyId(laneId);
    const ok = await patch({ action: "remove", laneId });
    setBusyId(null);
    if (ok) setLanes((prev) => prev.filter((l) => l.id !== laneId));
  }

  async function setStatus(laneId: string, status: string) {
    setBusyId(laneId);
    const ok = await patch({ action: "setStatus", laneId, status });
    setBusyId(null);
    if (ok) {
      setLanes((prev) => prev.map((l) => (l.id === laneId ? { ...l, status } : l)));
    }
  }

  async function reorderBySeed() {
    const ordered = [...lanes].sort(
      (a, b) => (a.seedRank ?? 9999) - (b.seedRank ?? 9999) || a.name.localeCompare(b.name)
    );
    setBusyId("reorder");
    const ok = await patch({
      action: "reorder",
      orderedLaneIds: ordered.map((l) => l.id),
    });
    setBusyId(null);
    if (ok) {
      setLanes(
        ordered.map((l, idx) => ({
          ...l,
          seedRank: idx + 1,
          displayOrder: idx + 1,
        }))
      );
    }
  }

  function updateLocal(id: string, patchLane: Partial<FieldReviewLane>) {
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patchLane } : l)));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ft-gold">
              Contest field review
            </p>
            <h1 className="mt-1 text-xl font-semibold text-neutral-50">{contest.title}</h1>
            <p className="mt-2 text-sm text-neutral-400">
              {formatContestLifecycleLabel(contest.status)} · {contest.sport}
              {contest.week != null ? ` · Week ${contest.week}` : ""}
              {formatSlateLabel(contest.slate) ? ` · ${formatSlateLabel(contest.slate)}` : ""}
              {formatScoringLabel(contest.scoringFormat)
                ? ` · ${formatScoringLabel(contest.scoringFormat)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/admin/roster-import?contestId=${contest.id}`}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-neutral-200"
            >
              Return to importer
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-neutral-200"
            >
              Contest settings
            </Link>
            <Link
              href={`/contest/${contest.id}`}
              className="rounded-full bg-ft-cta px-3 py-1.5 font-semibold text-neutral-950"
            >
              Public preview
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total players" value={String(lanes.length)} />
          <Stat label="Teams" value={String(teams)} />
          <Stat label="Position" value={position} />
          <Stat label="Lifecycle" value={formatContestLifecycleLabel(contest.status)} />
          <Stat label="Pool total" value={formatCoins(poolTotal)} />
          <Stat label="Entries" value={String(entryCount)} />
          <Stat
            label="Odds"
            value={poolTotal > 0 ? "Established" : "Not established"}
          />
          <Stat
            label="Lock time"
            value={new Date(contest.startTime).toLocaleString()}
          />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-50">Runners</h2>
          <button
            type="button"
            disabled={busyId === "reorder"}
            onClick={() => void reorderBySeed()}
            className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
          >
            Reorder by seed rank
          </button>
        </div>

        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-emerald-300">{message}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
          <table className="min-w-full text-left text-xs text-neutral-200">
            <thead className="bg-black/40 text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">Seed</th>
                <th className="px-2 py-2">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Opp</th>
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Proj</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Pool</th>
                <th className="px-2 py-2">Entries</th>
                <th className="px-2 py-2">Odds</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((lane) => (
                <tr key={lane.id} className="border-t border-neutral-800/80 align-top">
                  <td className="px-2 py-2">
                    <input
                      className="w-12 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.seedRank ?? ""}
                      onChange={(e) =>
                        updateLocal(lane.id, {
                          seedRank: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="min-w-[140px] rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.name}
                      onChange={(e) => updateLocal(lane.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.team}
                      onChange={(e) => updateLocal(lane.id, { team: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.opponent ?? ""}
                      onChange={(e) => updateLocal(lane.id, { opponent: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-12 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.position}
                      onChange={(e) => updateLocal(lane.id, { position: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.depthRole ?? ""}
                      onChange={(e) => updateLocal(lane.id, { depthRole: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.projectedPoints ?? ""}
                      onChange={(e) =>
                        updateLocal(lane.id, {
                          projectedPoints:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                      value={lane.status}
                      onChange={(e) => void setStatus(lane.id, e.target.value)}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="QUESTIONABLE">QUESTIONABLE</option>
                      <option value="DOUBTFUL">DOUBTFUL</option>
                      <option value="SCRATCHED">SCRATCHED</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatCoins(lane.poolAmount)}</td>
                  <td className="px-2 py-2 tabular-nums">{lane.entryCount}</td>
                  <td className="px-2 py-2">{lane.currentOddsLabel}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={busyId === lane.id}
                        onClick={() => void saveLane(lane)}
                        className="text-left text-ft-gold hover:underline"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busyId === lane.id}
                        onClick={() => void removeLane(lane.id)}
                        className="text-left text-red-300 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-black/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}
