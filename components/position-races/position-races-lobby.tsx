"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ClientOnly } from "@/components/client-only";
import { POSITION_RACES_POLL_MS } from "@/lib/constants";
import { formatCoins, formatDateTime } from "@/lib/format";
import type { PositionRacesLobbyPayload } from "@/lib/position-races/types";
import { PositionIcon, POSITION_THEME } from "@/components/position-races/position-theme";

function formatCountdown(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return "Locked";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusTone(status: string): string {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-400/45 bg-emerald-500/10 text-emerald-200";
    case "LOCKED":
      return "border-ft-gold/40 bg-ft-gold/10 text-ft-gold";
    case "SETTLED":
      return "border-white/15 bg-white/[0.06] text-neutral-300";
    default:
      return "border-neutral-600 bg-neutral-900 text-neutral-300";
  }
}

export default function PositionRacesLobby({
  initialData,
}: {
  initialData: PositionRacesLobbyPayload;
}) {
  const [data, setData] = useState(initialData);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyOpen = data.races.some((r) => r.status === "PUBLISHED");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/position-races?week=${data.week}&season=${data.season}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Refresh failed");
      const next = (await res.json()) as PositionRacesLobbyPayload;
      setData(next);
      setError(null);
      setLive(true);
    } catch {
      setError("Live refresh paused — showing last good board.");
      setLive(false);
    }
  }, [data.week, data.season]);

  useEffect(() => {
    if (!anyOpen) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, POSITION_RACES_POLL_MS);
      setLive(true);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      setLive(false);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [anyOpen, refresh]);

  const showLongShots = data.featuredLongShots.length > 0;

  return (
    <div className="space-y-10 text-neutral-100 sm:space-y-12">
      {/* Hero */}
      <section
        id="races"
        className="relative isolate overflow-hidden rounded-ft-lg border border-white/[0.08] shadow-ft-card"
      >
        <div className="absolute inset-0">
          <Image
            src="/week1-position-races-hero.jpg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-55"
            sizes="(max-width: 1200px) 100vw, 1152px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/55" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.18),transparent_55%)]" />
        </div>

        <div className="relative z-10 grid gap-8 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:items-end">
          <div className="max-w-2xl space-y-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ft-gold">
              NFL Week {data.week}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
              Week {data.week} Position Races
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
              Pick the player who will finish Sunday at the top of his position. Follow the
              live market as the field moves.
            </p>
            <p className="max-w-xl text-xs leading-relaxed text-neutral-500">
              FantasyTrack uses pooled free-play entries. Rankings organize the field;
              participant entries determine the live odds.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href="#boards"
                className="rounded-full bg-ft-cta px-5 py-2.5 text-sm font-bold text-neutral-950 shadow-ft-inner transition hover:brightness-110 ft-focus-ring"
              >
                View the Races
              </a>
              <Link
                href="/how-to-play"
                className="rounded-full border border-white/15 bg-black/40 px-5 py-2.5 text-sm font-semibold text-neutral-100 transition hover:border-ft-gold/40 hover:text-ft-gold ft-focus-ring"
              >
                How It Works
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Stat
              label="Slate lock"
              value={
                data.totals.earliestLockTime ? (
                  <ClientOnly>
                    <span>{formatDateTime(new Date(data.totals.earliestLockTime))}</span>
                  </ClientOnly>
                ) : (
                  "—"
                )
              }
            />
            <Stat label="Free-play pool" value={formatCoins(data.totals.totalPool)} />
            <Stat label="Total entries" value={String(data.totals.totalEntries)} />
            <Stat label="Active races" value={String(data.totals.activeRaces)} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <p>
          {live && anyOpen ? (
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live market feed
            </span>
          ) : (
            <span>Market snapshot</span>
          )}
          <span className="mx-2 text-neutral-700">·</span>
          Last updated{" "}
          <ClientOnly>
            <span>{formatDateTime(new Date(data.generatedAt))}</span>
          </ClientOnly>
        </p>
        {error ? <p className="text-amber-300/90">{error}</p> : null}
      </div>

      {/* Quad boards */}
      <section id="boards" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ft-label text-neutral-500">Live boards</p>
            <h2 className="text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">
              Position race markets
            </h2>
          </div>
        </div>

        {data.races.length === 0 ? (
          <div className="rounded-ft-lg border border-white/[0.08] bg-black/40 px-5 py-10 text-center text-sm text-neutral-400">
            Week {data.week} position races are not published yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.races.map((race) => {
              const theme = POSITION_THEME[race.position];
              return (
                <Link
                  key={race.contestId}
                  href={`/contest/${race.contestId}`}
                  className={`group relative flex flex-col overflow-hidden rounded-ft-lg border bg-ft-gradient-panel transition hover:brightness-110 ft-focus-ring ${theme.border} ${theme.glow}`}
                  aria-label={`${race.headline}. ${race.lifecycleLabel}. View full board.`}
                >
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.chip}`}
                        >
                          <PositionIcon position={race.position} className="h-3 w-3" />
                          {theme.label} Race
                        </span>
                        <h3 className="text-base font-bold tracking-tight text-neutral-50">
                          {race.headline}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(race.status)}`}
                      >
                        {race.lifecycleLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                      <div>
                        <p className="uppercase tracking-wide text-neutral-600">Lock</p>
                        <p className="font-semibold tabular-nums text-neutral-200">
                          {formatCountdown(race.timeToLockSeconds)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-neutral-600">Runners</p>
                        <p className="font-semibold tabular-nums text-neutral-200">
                          {race.runnerCount}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-neutral-600">Free-play pool</p>
                        <p className="font-semibold tabular-nums text-neutral-200">
                          {formatCoins(race.poolTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-neutral-600">Entries</p>
                        <p className="font-semibold tabular-nums text-neutral-200">
                          {race.entryCount}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-ft border border-white/[0.06] bg-black/35">
                      <table className="w-full min-w-[280px] text-left text-[11px]">
                        <thead className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                          <tr className="border-b border-white/[0.05]">
                            <th className="px-2 py-1.5">Rank</th>
                            <th className="px-2 py-1.5">Player</th>
                            <th className="px-2 py-1.5">Odds</th>
                            <th className="px-2 py-1.5">
                              {race.hasMeaningfulPool ? "Pool %" : "Proj"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {race.topLanes.map((lane, idx) => {
                            const rank = race.hasMeaningfulPool
                              ? lane.marketRank ?? idx + 1
                              : lane.projectedRank ?? idx + 1;
                            return (
                              <tr
                                key={lane.id}
                                className="border-b border-white/[0.04] text-neutral-200 last:border-0"
                              >
                                <td className={`px-2 py-1 tabular-nums ${theme.accentText}`}>
                                  {rank}
                                </td>
                                <td className="max-w-[7.5rem] truncate px-2 py-1 font-medium text-neutral-100">
                                  {lane.name}
                                </td>
                                <td className="px-2 py-1 tabular-nums text-neutral-300">
                                  {lane.oddsEstablished ? lane.oddsLabel : "—"}
                                </td>
                                <td className="px-2 py-1 tabular-nums text-neutral-400">
                                  {race.hasMeaningfulPool
                                    ? lane.poolSharePct != null
                                      ? `${lane.poolSharePct}%`
                                      : "0%"
                                    : lane.projectedPoints != null
                                      ? lane.projectedPoints.toFixed(1)
                                      : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!race.hasMeaningfulPool ? (
                        <p className="border-t border-white/[0.05] px-2 py-1.5 text-[10px] text-neutral-500">
                          Pool odds not established · sorted by projected rank
                        </p>
                      ) : null}
                    </div>

                    <div className="flex justify-end pt-1">
                      <span className="rounded-full border border-ft-gold/35 bg-black/50 px-3 py-1.5 text-xs font-semibold text-ft-gold transition group-hover:border-ft-gold/55 group-hover:bg-ft-gold/10">
                        {race.status === "PUBLISHED" ? "Enter Race" : "View Full Board"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Supporting modules */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ModuleCard
          title={showLongShots ? "Featured Long Shots" : "Players to Watch"}
          subtitle={
            showLongShots
              ? "Longer current pool odds across the four races"
              : "Projected standouts while the pool forms"
          }
        >
          <ul className="space-y-2.5">
            {(showLongShots ? data.featuredLongShots : data.playersToWatch).map((p) => (
              <li key={`${p.contestId}-${p.laneId}`}>
                <Link
                  href={`/contest/${p.contestId}`}
                  className="flex items-center justify-between gap-3 rounded-ft border border-white/[0.06] bg-black/30 px-3 py-2 transition hover:border-ft-gold/30 ft-focus-ring"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-100">{p.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {p.position}
                      {p.projectedRank != null ? ` · Proj #${p.projectedRank}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[11px]">
                    <p className="font-semibold tabular-nums text-neutral-200">
                      {showLongShots ? p.oddsLabel : p.projectedRank != null ? `#${p.projectedRank}` : "—"}
                    </p>
                    <p className="text-neutral-500">
                      {p.poolSharePct != null ? `${p.poolSharePct}% pool` : "No pool yet"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {(showLongShots ? data.featuredLongShots : data.playersToWatch).length === 0 ? (
              <p className="text-sm text-neutral-500">Field data will appear when races load.</p>
            ) : null}
          </ul>
        </ModuleCard>

        <ModuleCard
          title="Biggest Movers"
          subtitle="Market rank and odds movement"
        >
          {data.movementAvailable ? (
            <p className="text-sm text-neutral-400">Movement feed coming online.</p>
          ) : (
            <div className="rounded-ft border border-dashed border-white/10 bg-black/20 px-3 py-6 text-center">
              <p className="text-sm text-neutral-400">
                Movement appears once the market starts changing.
              </p>
            </div>
          )}
        </ModuleCard>

        <ModuleCard title="Market Snapshot" subtitle="Current free-play signals">
          <dl className="space-y-3 text-sm">
            <SnapRow
              label="Most backed"
              value={
                data.marketSnapshot.mostBacked
                  ? `${data.marketSnapshot.mostBacked.name} (${data.marketSnapshot.mostBacked.position})`
                  : "No entries yet"
              }
            />
            <SnapRow
              label="Largest position pool"
              value={
                data.marketSnapshot.largestPool
                  ? `${data.marketSnapshot.largestPool.position} · ${formatCoins(data.marketSnapshot.largestPool.poolTotal)}`
                  : "—"
              }
            />
            <SnapRow
              label="Closest race"
              value={
                data.marketSnapshot.closestRace
                  ? `${data.marketSnapshot.closestRace.position}: ${data.marketSnapshot.closestRace.leaderSharePct}% / ${data.marketSnapshot.closestRace.secondSharePct}%`
                  : "Waiting on pool shares"
              }
            />
            <SnapRow label="Total entries" value={String(data.marketSnapshot.totalEntries)} />
            <SnapRow
              label="Time until lock"
              value={formatCountdown(data.marketSnapshot.earliestLockSeconds)}
            />
          </dl>
        </ModuleCard>
      </section>

      {/* Other contests */}
      {data.otherContests.length > 0 ? (
        <section className="space-y-3 border-t border-white/[0.06] pt-8">
          <div>
            <p className="ft-label text-neutral-500">Also on FantasyTrack</p>
            <h2 className="text-lg font-bold text-neutral-50">Other contests &amp; series</h2>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.otherContests.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contest/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-ft border border-white/[0.07] bg-black/30 px-3 py-2.5 transition hover:border-ft-gold/30 ft-focus-ring"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-100">{c.title}</p>
                    <p className="text-[11px] text-neutral-500">
                      {c.seriesName ?? c.sport}
                      <span className="mx-1.5 text-neutral-700">·</span>
                      <ClientOnly>
                        <span>{formatDateTime(new Date(c.startTime))}</span>
                      </ClientOnly>
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusTone(c.status)}`}>
                    {c.status === "PUBLISHED" ? "Open" : c.status === "LOCKED" ? "Locked" : c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Looking for your series home?{" "}
            <Link href="/dashboard" className="text-ft-gold hover:underline">
              Enter the Track
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-ft border border-white/10 bg-black/45 px-3 py-2.5 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">{value}</p>
    </div>
  );
}

function ModuleCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-ft-lg border border-white/[0.07] bg-ft-gradient-panel p-4 shadow-ft-card">
      <p className="text-sm font-bold text-neutral-50">{title}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-200">{value}</dd>
    </div>
  );
}
