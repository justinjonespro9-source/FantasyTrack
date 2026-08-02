"use client";

import { useMemo, useState, useTransition } from "react";
import {
  bulkUpdateContestLockTimeAction,
  previewContestLockTimeAction,
  type LockTimePreviewRow,
} from "@/app/admin/lock-time-actions";
import { formatLockTimeCt, parseCentralDateTime } from "@/lib/contest/central-time";

export type BulkLockContestOption = {
  id: string;
  title: string;
  status: string;
  startTimeIso: string;
  seriesName: string;
  week: number | null;
  season: number | null;
  contestType: string | null;
};

type Props = {
  contests: BulkLockContestOption[];
};

const DEFAULT_DATE = "2026-09-13";
const DEFAULT_TIME = "10:00";

export function BulkLockTimePanel({ contests }: Props) {
  const positionRaces = useMemo(
    () =>
      contests.filter(
        (c) =>
          c.contestType === "POSITION_WEEKLY" ||
          /\b(QB|RB|WR|TE)\b/i.test(c.title)
      ),
    [contests]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [lockDate, setLockDate] = useState(DEFAULT_DATE);
  const [lockTime, setLockTime] = useState(DEFAULT_TIME);
  const [preview, setPreview] = useState<LockTimePreviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const interpretedLabel = useMemo(() => {
    try {
      return formatLockTimeCt(parseCentralDateTime(lockDate, lockTime));
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid";
    }
  }, [lockDate, lockTime]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPreview(null);
  }

  function selectWeek1Four() {
    const wanted = ["QB", "RB", "WR", "TE"];
    const picks: string[] = [];
    for (const pos of wanted) {
      const match = positionRaces.find(
        (c) =>
          c.week === 1 &&
          (c.season === 2026 || c.season == null) &&
          new RegExp(`\\b${pos}\\b`, "i").test(c.title) &&
          !/smoke|empty pool|qa |prod verify/i.test(c.title)
      );
      if (match) picks.push(match.id);
    }
    setSelected(picks);
    setPreview(null);
  }

  function runPreview() {
    setError("");
    startTransition(async () => {
      try {
        const result = await previewContestLockTimeAction({
          contestIds: selected,
          lockDate,
          lockTime,
          reopenMode: "auto",
        });
        setPreview(result.rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preview failed");
      }
    });
  }

  function apply(reopenMode: "auto" | "update_and_reopen" | "time_only") {
    if (!preview?.length) {
      setError("Preview the changes before applying.");
      return;
    }
    const lines = [
      `Apply lock time ${interpretedLabel} to ${preview.length} race(s)?`,
      ...preview.map(
        (r) =>
          `• ${r.title}: ${r.status} → ${r.willReopen ? "reopen" : "keep status"}; snapshots ${
            r.willClearClosingSnapshots ? "cleared" : "kept"
          }`
      ),
    ];
    if (!window.confirm(lines.join("\n"))) return;

    const fd = new FormData();
    fd.set("contestIds", selected.join(","));
    fd.set("lockDate", lockDate);
    fd.set("lockTime", lockTime);
    fd.set("reopenMode", reopenMode);

    startTransition(() => {
      void bulkUpdateContestLockTimeAction(fd).catch((e: unknown) => {
        const digest =
          e && typeof e === "object" && "digest" in e
            ? String((e as { digest?: string }).digest ?? "")
            : "";
        if (digest.startsWith("NEXT_REDIRECT")) return;
        setError(e instanceof Error ? e.message : "Update failed");
      });
    });
  }

  if (positionRaces.length === 0) return null;

  return (
    <section className="rounded border border-track-200 bg-track-50/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-track-800">
        Bulk edit lock time
      </h2>
      <p className="mt-1 text-xs text-track-600">
        Times are entered in Central Time and stored in UTC. Select related position races and
        apply one shared lock time.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="font-medium">Date</span>
          <input
            type="date"
            value={lockDate}
            onChange={(e) => {
              setLockDate(e.target.value);
              setPreview(null);
            }}
            className="mt-0.5 block rounded border border-track-200 px-2 py-1"
          />
        </label>
        <label className="text-xs">
          <span className="font-medium">Time (CT)</span>
          <input
            type="time"
            value={lockTime}
            onChange={(e) => {
              setLockTime(e.target.value);
              setPreview(null);
            }}
            className="mt-0.5 block rounded border border-track-200 px-2 py-1"
          />
        </label>
        <p className="text-xs text-track-700">
          Interpreted: <span className="font-semibold">{interpretedLabel}</span>
        </p>
        <button
          type="button"
          onClick={selectWeek1Four}
          className="rounded bg-track-100 px-2 py-1 text-xs font-semibold text-track-800"
        >
          Select Week 1 QB/RB/WR/TE
        </button>
      </div>

      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
        {positionRaces.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-white/80">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-track-900">{c.title}</span>
                <span className="block text-track-600">
                  {c.status} · {formatLockTimeCt(new Date(c.startTimeIso))} · {c.seriesName}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || selected.length === 0}
          onClick={runPreview}
          className="rounded bg-track-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={pending || !preview?.length}
          onClick={() => apply("auto")}
          className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-neutral-950 disabled:opacity-50"
        >
          Confirm &amp; apply
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {preview ? (
        <div className="mt-3 overflow-x-auto rounded border border-track-200 bg-white">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-track-50 text-track-700">
              <tr>
                <th className="px-2 py-1">Contest</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Current lock</th>
                <th className="px-2 py-1">New lock</th>
                <th className="px-2 py-1">Reopen?</th>
                <th className="px-2 py-1">Clear snapshots?</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.id} className="border-t border-track-100">
                  <td className="px-2 py-1 font-medium">{r.title}</td>
                  <td className="px-2 py-1">{r.status}</td>
                  <td className="px-2 py-1">{r.currentLockLabel}</td>
                  <td className="px-2 py-1">{r.newLockLabel}</td>
                  <td className="px-2 py-1">{r.willReopen ? "Yes" : "No"}</td>
                  <td className="px-2 py-1">
                    {r.willClearClosingSnapshots ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.some((r) => r.warnings.length) ? (
            <ul className="space-y-1 border-t border-track-100 px-2 py-2 text-[11px] text-amber-900">
              {preview.flatMap((r) =>
                r.warnings.map((w, i) => (
                  <li key={`${r.id}-${i}`}>
                    {r.title}: {w}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
