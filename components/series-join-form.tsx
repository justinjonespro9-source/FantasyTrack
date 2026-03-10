"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeriesJoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/series/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        alreadyMember?: boolean;
        seriesId?: string;
        seriesName?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Unable to join series.");
      }

      const targetSeriesId = data.seriesId;
      const status = data.alreadyMember ? "alreadyMember" : "joined";
      const nameParam = data.seriesName
        ? `&seriesName=${encodeURIComponent(data.seriesName)}`
        : "";

      if (targetSeriesId) {
        // Redirect to the existing series leaderboard page with status in the query string.
        router.push(
          `/series/${targetSeriesId}/leaderboard?seriesStatus=${encodeURIComponent(
            status
          )}${nameParam}`
        );
      } else {
        // Fallback: safe redirect to dashboard with a status hint.
        router.push(
          `/dashboard?seriesStatus=${encodeURIComponent(status)}${nameParam}`
        );
      }
    } catch (err: any) {
      setError(err?.message || "Unable to join series.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Invite code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code (e.g. FRAT23)"
          className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          maxLength={32}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full border border-amber-400/70 bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Joining..." : "Join Series"}
      </button>

      <p className="text-[11px] text-neutral-500">
        Joining a series lets you compete in private leaderboards for your group. Codes are provided
        by the Series organizer.
      </p>
    </form>
  );
}

