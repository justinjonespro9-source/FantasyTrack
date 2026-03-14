"use client";

import { useState } from "react";

export function PullLiveStatsButton({ contestId }: { contestId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/internal/basketball-live-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? `Error ${res.status}`);
        return;
      }
      setMessage(
        data.updated != null
          ? `Updated ${data.updated} lane(s).`
          : "Done."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? "Pulling…" : "Pull live stats"}
      </button>
      {message && (
        <span className="text-xs text-neutral-300">
          {message}
        </span>
      )}
    </span>
  );
}
