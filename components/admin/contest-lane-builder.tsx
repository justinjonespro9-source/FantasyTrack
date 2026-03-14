"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ContestOption = {
  id: string;
  title: string;
  sport: string;
  startTime: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
};

type PlayerOption = {
  id: string;
  fullName: string;
  position?: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  market?: string | null;
  abbreviation?: string | null;
  players: PlayerOption[];
};

type LeagueOption = {
  id: string;
  name: string;
  sport: string;
  code: string;
  teams: TeamOption[];
};

type Props = {
  contests: ContestOption[];
  leagues: LeagueOption[];
  /** When present (e.g. from ?contestId=), preselect this contest so create→build-lanes flow is seamless. */
  initialContestId?: string;
};

export default function ContestLaneBuilder({ contests, leagues, initialContestId }: Props) {
  const router = useRouter();
  const [contestId, setContestId] = useState<string>(initialContestId ?? "");
  const [leagueId, setLeagueId] = useState<string>("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedContest = contests.find((c) => c.id === contestId) ?? null;

  const linkedTeamIds = useMemo(() => {
    if (!selectedContest) return [] as string[];
    const ids = [selectedContest.homeTeamId, selectedContest.awayTeamId].filter(
      (id): id is string => !!id
    );
    return Array.from(new Set(ids));
  }, [selectedContest]);

  const leaguesForSport = useMemo(() => {
    if (!selectedContest) return leagues;
    return leagues.filter((l) => l.sport === selectedContest.sport);
  }, [leagues, selectedContest]);

  const selectedLeague = leagues.find((l) => l.id === leagueId) ?? null;

  const teamsForLeague = selectedLeague?.teams ?? [];

  const playersForSelectedTeams = useMemo(() => {
    if (!selectedLeague) return [];
    const selectedTeams = selectedLeague.teams.filter((t) =>
      selectedTeamIds.includes(t.id)
    );
    return selectedTeams.flatMap((t) =>
      t.players.map((p) => ({
        ...p,
        teamLabel: [t.market, t.name].filter(Boolean).join(" "),
      }))
    );
  }, [selectedLeague, selectedTeamIds]);

  // When a contest with linked teams is selected, auto-select the league and teams
  useEffect(() => {
    if (!selectedContest || linkedTeamIds.length === 0) return;

    // Find a league that contains at least one of the linked teams
    const leagueWithTeams = leagues.find((league) =>
      league.teams.some((team) => linkedTeamIds.includes(team.id))
    );

    if (!leagueWithTeams) return;

    setLeagueId(leagueWithTeams.id);

    const teamIdsInLeague = leagueWithTeams.teams
      .filter((team) => linkedTeamIds.includes(team.id))
      .map((team) => team.id);

    setSelectedTeamIds(teamIdsInLeague);
    setSelectedPlayerIds([]); // players remain manual selection
  }, [leagues, linkedTeamIds, selectedContest]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
    setSelectedPlayerIds((prev) =>
      prev.filter((playerId) =>
        playersForSelectedTeams.some((p) => p.id === playerId)
      )
    );
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contestId || selectedPlayerIds.length === 0) {
      setError("Select a contest and at least one player.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/contest-lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId, playerIds: selectedPlayerIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Unable to create lanes.");
      }
      setMessage("Lanes created from selected players.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to create lanes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Contest
          </label>
          <select
            value={contestId}
            onChange={(e) => {
              setContestId(e.target.value);
              setLeagueId("");
              setSelectedTeamIds([]);
              setSelectedPlayerIds([]);
            }}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          >
            <option value="">Select contest…</option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.sport})
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
              setSelectedTeamIds([]);
              setSelectedPlayerIds([]);
            }}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/60"
          >
            <option value="">Select league…</option>
            {leaguesForSport.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Teams
          </p>
          {linkedTeamIds.length > 0 && selectedLeague ? (
            <p className="mt-1 text-[11px] text-neutral-500">
              Using teams linked to this contest. You can change the league or teams if needed.
            </p>
          ) : null}
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/80 p-2 text-sm">
            {teamsForLeague.length === 0 ? (
              <p className="text-xs text-neutral-500">Select a league to see teams.</p>
            ) : (
              teamsForLeague.map((team) => {
                const label = [team.market, team.name]
                  .filter(Boolean)
                  .join(" ");
                const checked = selectedTeamIds.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 hover:bg-neutral-900"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeam(team.id)}
                      />
                      <span className="text-neutral-100">{label}</span>
                    </span>
                    {team.abbreviation ? (
                      <span className="text-xs text-neutral-500">
                        {team.abbreviation}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Players
          </p>
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/80 p-2 text-sm">
            {playersForSelectedTeams.length === 0 ? (
              <p className="text-xs text-neutral-500">Select one or more teams to see players.</p>
            ) : (
              playersForSelectedTeams.map((player) => {
                const checked = selectedPlayerIds.includes(player.id);
                return (
                  <label
                    key={player.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 hover:bg-neutral-900"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlayer(player.id)}
                      />
                      <span className="text-neutral-100">{player.fullName}</span>
                      {player.position ? (
                        <span className="text-[11px] text-neutral-500">
                          {player.position}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {player.teamLabel}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full border border-amber-400/70 bg-amber-400 px-5 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating lanes..." : "Create lanes from players"}
        </button>
      </div>
    </form>
  );
}

