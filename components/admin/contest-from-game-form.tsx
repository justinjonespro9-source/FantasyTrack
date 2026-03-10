"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SPORTS, formatSportLabel, type SportKey } from "@/lib/sports";

type LeagueOption = {
  id: string;
  name: string;
  code: string;
  sport: string;
  externalId: string | null;
};

type SeriesOption = {
  id: string;
  name: string;
};

type ScheduleGame = {
  id: string;
  startTime: string;
  homeTeamId: string;
  awayTeamId: string;
  homeLabel: string;
  awayLabel: string;
  externalId: string;
  externalProvider: string;
};

type Props = {
  leagues: LeagueOption[];
  seriesList: SeriesOption[];
};

function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function ContestFromGameForm({ leagues, seriesList }: Props) {
  const [sport, setSport] = useState<string>("");
  const [leagueId, setLeagueId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string>("");
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [scheduleSport, setScheduleSport] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createdContestId, setCreatedContestId] = useState<string | null>(null);

  const leaguesForSport = useMemo(() => {
    if (!sport) return [];
    return leagues.filter((l) => l.sport === sport);
  }, [leagues, sport]);

  async function loadSchedule() {
    if (!leagueId) {
      setError("Select a league first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setGames([]);
    setScheduleSport("");
    try {
      const res = await fetch(`/api/admin/schedule?leagueId=${encodeURIComponent(leagueId)}`);
      const data = (await res.json()) as {
        games?: ScheduleGame[];
        sport?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load schedule.");
      }
      setGames(data.games ?? []);
      setScheduleSport(data.sport ?? sport);
      if ((data.games ?? []).length === 0 && data.message) {
        setMessage(data.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function createContest(game: ScheduleGame) {
    if (!seriesId) {
      setError("Select a series first.");
      return;
    }
    const sportToUse = scheduleSport || sport;
    if (!sportToUse) {
      setError("Sport is missing.");
      return;
    }
    setCreatingId(game.id);
    setError(null);
    setMessage(null);
    setCreatedContestId(null);
    try {
      const res = await fetch("/api/admin/contest-from-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          sport: sportToUse,
          startTime: game.startTime,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          externalProvider: game.externalProvider,
          externalId: game.externalId,
          homeLabel: game.homeLabel,
          awayLabel: game.awayLabel,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; contest?: { id: string; title: string } };
      if (!res.ok) {
        throw new Error(data.error || "Failed to create contest.");
      }
      setCreatedContestId(data.contest?.id ?? null);
      setMessage(data.contest ? `Contest created: ${data.contest.title}` : "Contest created.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create contest.");
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Sport
          </label>
          <select
            value={sport}
            onChange={(e) => {
              setSport(e.target.value);
              setLeagueId("");
              setGames([]);
              setScheduleSport("");
            }}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          >
            <option value="">Select sport…</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {formatSportLabel(s as SportKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            League
          </label>
          <select
            value={leagueId}
            onChange={(e) => {
              setLeagueId(e.target.value);
              setGames([]);
              setScheduleSport("");
            }}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          >
            <option value="">Select league…</option>
            {leaguesForSport.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
                {!l.externalId ? " (no schedule)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Series
          </label>
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          >
            <option value="">Select series…</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={loadSchedule}
          disabled={!leagueId || loading}
          className="rounded-full border border-amber-400/70 bg-amber-400 px-5 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Loading…" : "Load games"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {createdContestId ? (
        <p className="text-sm text-amber-200">
          <Link
            href={`/admin/contest-lanes?contestId=${encodeURIComponent(createdContestId)}`}
            className="underline hover:no-underline"
          >
            Build lanes for this contest
          </Link>
          {" · "}
          <Link
            href={`/contest/${createdContestId}`}
            className="underline hover:no-underline"
          >
            View contest
          </Link>
        </p>
      ) : null}

      {games.length > 0 ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-950/80">
          <p className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Imported games — create contest
          </p>
          <ul className="divide-y divide-neutral-800">
            {games.map((game) => (
              <li
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="text-sm text-neutral-100">
                  {game.awayLabel} @ {game.homeLabel}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatGameTime(game.startTime)}
                </span>
                <button
                  type="button"
                  onClick={() => createContest(game)}
                  disabled={!seriesId || creatingId !== null}
                  className="rounded border border-amber-400/70 bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creatingId === game.id ? "Creating…" : "Create contest"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
