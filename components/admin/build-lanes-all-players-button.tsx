"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  contestId: string;
  sport: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

export function BuildLanesAllPlayersButton({ contestId, sport, homeTeamId, awayTeamId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const show = sport === "BASKETBALL" && homeTeamId && awayTeamId;
  if (!show) return null;

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/contest-lanes/auto-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; created?: number; skipped?: number; totalPlayers?: number };
      if (!res.ok) {
        setMessage(data.error ?? "Failed.");
        return;
      }
      setMessage(`Created ${data.created ?? 0} lane(s). ${data.skipped ?? 0} already had lanes.`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-amber-500/70 bg-amber-500/20 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-70"
      >
        {loading ? "Building…" : "Build lanes for all players in this game"}
      </button>
      {message && <p className="text-xs text-neutral-300">{message}</p>}
      <p className="text-[11px] text-neutral-500">
        <Link href={`/admin/contest-lanes?contestId=${encodeURIComponent(contestId)}`} className="underline">
          Lane builder
        </Link>{" "}
        for manual selection.
      </p>
    </div>
  );
}
