"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { contestId: string; sport: string };

export function PullLiveStatsButton({ contestId, sport }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isHockey = sport === "HOCKEY";
  const endpoint = isHockey
    ? "/api/internal/hockey-live-stats"
    : "/api/internal/basketball-live-stats";

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
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
      router.refresh();
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
