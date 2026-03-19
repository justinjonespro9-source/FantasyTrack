"use client";

import { useState } from "react";

type BulkResult = {
  updated: number;
  skipped: number;
  failed: number;
  contestCount: number;
  completedAt: string;
};

export function BulkPullLiveStatsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/internal/basketball-live-stats/bulk", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? `Error ${res.status}`);
        return;
      }
      setLastResult({
        updated: data.updated ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        contestCount: data.contestCount ?? 0,
        completedAt: data.completedAt ?? new Date().toISOString(),
      });
      setMessage(
        `Updated ${data.updated ?? 0} lane(s) across ${data.contestCount ?? 0} contest(s). ` +
          `Skipped: ${data.skipped ?? 0}. Failed: ${data.failed ?? 0}.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {loading ? "Pulling…" : "Pull live stats for all basketball contests"}
        </button>
        {lastResult && (
          <span className="text-xs text-neutral-400">
            Last run: {new Date(lastResult.completedAt).toLocaleString()} — {lastResult.updated} updated, {lastResult.skipped} skipped, {lastResult.failed} failed
          </span>
        )}
      </div>
      {message && (
        <p className="text-xs text-neutral-300">
          {message}
        </p>
      )}
    </div>
  );
}
