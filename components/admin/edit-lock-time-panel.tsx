"use client";

import { useMemo, useState, useTransition } from "react";
import {
  updateContestLockTimeFormAction,
} from "@/app/admin/lock-time-actions";
import {
  formatLockTimeCt,
  parseCentralDateTime,
  toCentralDateTimeParts,
} from "@/lib/contest/central-time";

type Props = {
  contestId: string;
  title: string;
  status: string;
  startTimeIso: string;
  lockSource: string | null;
  ticketCount: number;
  hasClosingSnapshots: boolean;
};

export function EditLockTimePanel({
  contestId,
  title,
  status,
  startTimeIso,
  lockSource,
  ticketCount,
  hasClosingSnapshots,
}: Props) {
  const initial = useMemo(
    () => toCentralDateTimeParts(new Date(startTimeIso)),
    [startTimeIso]
  );
  const [open, setOpen] = useState(false);
  const [lockDate, setLockDate] = useState(initial.date);
  const [lockTime, setLockTime] = useState(initial.time);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const interpreted = useMemo(() => {
    try {
      const utc = parseCentralDateTime(lockDate, lockTime);
      return {
        label: formatLockTimeCt(utc),
        iso: utc.toISOString(),
        isFuture: utc.getTime() > Date.now(),
      };
    } catch (e) {
      return {
        label: e instanceof Error ? e.message : "Invalid date/time",
        iso: "",
        isFuture: false,
      };
    }
  }, [lockDate, lockTime]);

  const isManualLocked =
    status === "LOCKED" && (lockSource ?? "").toUpperCase() === "MANUAL";
  const canAutoReopen =
    status === "LOCKED" && !isManualLocked && interpreted.isFuture;
  const settled = status === "SETTLED";

  function submit(reopenMode: "auto" | "update_and_reopen" | "time_only") {
    setError("");
    if (settled) {
      setError(
        "Settled contests cannot be reopened through this editor. Use the settlement reopen workflow first."
      );
      return;
    }
    if (!interpreted.iso) {
      setError(interpreted.label);
      return;
    }

    const warnings: string[] = [];
    if (ticketCount > 0) {
      warnings.push(
        `This race has ${ticketCount} existing entries. They will remain active after the lock time changes.`
      );
    }
    if (hasClosingSnapshots && (reopenMode !== "time_only" || canAutoReopen)) {
      warnings.push("Prior closing odds snapshots will be cleared if the race reopens.");
    }
    if (!interpreted.isFuture) {
      warnings.push("The new lock time is in the past.");
    }

    if (isManualLocked && reopenMode === "auto") {
      // Should use explicit buttons
      return;
    }

    const confirmLines = [
      `Update lock time for ${title}?`,
      `New time: ${interpreted.label}`,
      `Stored as UTC: ${interpreted.iso}`,
      ...warnings,
    ];
    if (canAutoReopen && reopenMode !== "time_only") {
      confirmLines.push("This race will be reopened automatically.");
    }
    if (!window.confirm(confirmLines.join("\n\n"))) return;

    const fd = new FormData();
    fd.set("contestId", contestId);
    fd.set("lockDate", lockDate);
    fd.set("lockTime", lockTime);
    fd.set("reopenMode", reopenMode);

    startTransition(() => {
      void updateContestLockTimeFormAction(fd).catch((e: unknown) => {
        const digest =
          e && typeof e === "object" && "digest" in e
            ? String((e as { digest?: string }).digest ?? "")
            : "";
        if (digest.startsWith("NEXT_REDIRECT")) return;
        setError(e instanceof Error ? e.message : "Update failed");
      });
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-amber-500/90 px-3 py-1 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
      >
        {open ? "Close Lock Editor" : "Edit Lock Time"}
      </button>

      {open ? (
        <div className="mt-1 w-full min-w-[18rem] max-w-md rounded border border-track-200 bg-white p-3 text-sm text-track-800 shadow-sm">
          <p className="font-semibold text-track-900">Lock date &amp; time</p>
          <p className="mt-0.5 text-xs text-track-600">
            Times are entered in Central Time and stored in UTC.
          </p>
          <p className="mt-2 text-xs text-track-600">
            Current: {formatLockTimeCt(new Date(startTimeIso))} · {status}
            {lockSource ? ` · ${lockSource}` : ""}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="font-medium text-track-700">Date</span>
              <input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                className="mt-0.5 w-full rounded border border-track-200 px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-track-700">Time (CT)</span>
              <input
                type="time"
                value={lockTime}
                onChange={(e) => setLockTime(e.target.value)}
                className="mt-0.5 w-full rounded border border-track-200 px-2 py-1"
              />
            </label>
          </div>

          <p className="mt-2 text-xs text-track-700">
            Will save as: <span className="font-semibold">{interpreted.label}</span>
            {interpreted.iso ? (
              <span className="block font-mono text-[10px] text-track-500">{interpreted.iso}</span>
            ) : null}
          </p>

          {ticketCount > 0 ? (
            <p className="mt-2 text-xs text-amber-800">
              This race has {ticketCount} existing entries. They will remain active after the lock
              time changes.
            </p>
          ) : null}

          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

          {settled ? (
            <p className="mt-3 text-xs font-medium text-red-700">
              Settled contests are protected. Do not use this editor to reverse settlement.
            </p>
          ) : isManualLocked ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-amber-900">
                This race was manually locked. Update the time and reopen it?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("update_and_reopen")}
                  className="rounded bg-track-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Update and Reopen
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("time_only")}
                  className="rounded bg-track-100 px-2.5 py-1 text-xs font-semibold text-track-800 disabled:opacity-50"
                >
                  Update Time Only
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="rounded px-2.5 py-1 text-xs text-track-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !interpreted.iso}
                onClick={() => submit("auto")}
                className="rounded bg-track-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save lock time"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded px-2.5 py-1 text-xs text-track-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
