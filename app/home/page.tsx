import Link from "next/link";
import { SettledRaceBoard } from "@/components/settled-race-board";

/** Sample rows for homepage only — same shape as real settled board (finalRank 1–3 → Win / Place / Show). */
const SAMPLE_SETTLED_ROWS = [
  {
    id: "sample-sb-w",
    name: "Seattle Defense",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 1,
    fantasyPoints: 22,
    openingWinOddsTo1: 46,
    winTotal: 9873,
    placeTotal: 4620,
    showTotal: 2955,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
  {
    id: "sample-sb-p",
    name: "K. Walker III",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 2,
    fantasyPoints: 21.1,
    openingWinOddsTo1: 11,
    winTotal: 59260,
    placeTotal: 27450,
    showTotal: 18650,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
  {
    id: "sample-sb-s",
    name: "Drake Maye",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 3,
    fantasyPoints: 20.5,
    openingWinOddsTo1: 6,
    winTotal: 81875,
    placeTotal: 39560,
    showTotal: 24430,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
  {
    id: "sample-sb-4",
    name: "J. Myers",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 4,
    fantasyPoints: 19,
    openingWinOddsTo1: 31,
    winTotal: 12789,
    placeTotal: 7435,
    showTotal: 6672,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
  {
    id: "sample-sb-5",
    name: "M. Hollins",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 5,
    fantasyPoints: 17.8,
    openingWinOddsTo1: 55,
    winTotal: 7173,
    placeTotal: 5243,
    showTotal: 5189,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
  {
    id: "sample-sb-6",
    name: "R. Stevenson",
    team: "",
    position: "",
    status: "ACTIVE" as const,
    finalRank: 6,
    fantasyPoints: 17.38,
    openingWinOddsTo1: 12,
    winTotal: 51492,
    placeTotal: 28613,
    showTotal: 17340,
    winMultiple: null,
    placeMultiple: null,
    showMultiple: null,
  },
];

/** Unified premium gold (no lighter amber-100/200 variants on homepage) */
const gold = "text-amber-400";
const goldBorder = "border-amber-400/80";
const goldBtn = "rounded-full border border-amber-400 bg-amber-400 px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300";

export default function FantasyTrackHomePage() {
  return (
    <div className="-mx-4 -my-6 bg-neutral-950 px-4 py-8 text-neutral-100">
      {/* No duplicate header — top nav only from layout Nav */}

      <main className="mx-auto max-w-6xl lg:max-w-7xl">
        {/* Hero */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center">
          {/* Left: text */}
          <div className="space-y-5 max-w-lg">
            <div className="flex justify-center sm:justify-start">
              <div
                className={`inline-flex flex-col items-center rounded-full border ${goldBorder} bg-neutral-900/80 px-4 py-1 text-center shadow-sm`}
              >
                <p className={`text-[11px] font-semibold ${gold}`}>
                  Now in Free Beta • Play with Test Coins
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Hockey &bull; Basketball &bull; Baseball &bull; Golf
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-[2.1rem]">
                Player Performance Market
              </h1>
              <p className="max-w-md text-sm leading-6 text-neutral-300 sm:text-[15px]">
                FantasyTrack turns athlete performance into a live race. Pick your runners, track the
                fantasy leaderboard, and win when your ticket finishes on the podium.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className={goldBtn}>
                Enter the Track
              </Link>
              <Link
                href="/how-to-play"
                className="rounded-full border border-neutral-700 px-5 py-2 text-sm font-semibold text-neutral-100 hover:border-amber-400 hover:text-amber-400"
              >
                How It Works
              </Link>
            </div>
          </div>

          {/* Right: same settled board as real contest page — sample data only */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-neutral-50">
                Super Bowl Player Performance Market
              </h2>
              <p className="mt-1 text-sm text-neutral-300">
                <span className="font-medium text-neutral-100">Track Conditions:</span> Dry / Sunny
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                Sample final standings from a completed player performance market.
              </p>
            </div>
            <SettledRaceBoard rows={SAMPLE_SETTLED_ROWS} />
          </section>
        </section>

        {/* Feature cards */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
            <h3 className="text-sm font-semibold text-neutral-50">Pick Your Runners</h3>
            <p className="mt-2 text-sm text-neutral-300">
              Choose athletes competing in tonight&apos;s game. Each player earns fantasy points based
              on their real-game performance.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
            <h3 className="text-sm font-semibold text-neutral-50">Bet the Race</h3>
            <p className="mt-2 text-sm text-neutral-300">
              Back players to finish Win, Place, or Show as their fantasy points move them up the
              leaderboard.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
            <h3 className="text-sm font-semibold text-neutral-50">Watch the Leaderboard</h3>
            <p className="mt-2 text-sm text-neutral-300">
              The race updates live as players accumulate fantasy scoring throughout the game.
            </p>
          </div>
        </section>

        {/* Community CTA strip above footer */}
        <section className="mt-8 mb-2 grid gap-3 text-xs text-neutral-300 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-4">
            <h2 className="text-sm font-semibold text-neutral-50">Join the FantasyTrack Discord</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Join the official community for updates, contest talk, feedback, and early access news.
            </p>
            <div className="mt-2">
              <Link
                href="https://discord.gg/UYHWmy8j"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-semibold text-amber-300 hover:text-amber-200"
              >
                Join our Discord
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-4">
            <h2 className="text-sm font-semibold text-neutral-50">Invite Others</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Know someone who’d love FantasyTrack? Share it and help us build the field.
            </p>
            <div className="mt-2">
              <Link
                href="mailto:?subject=Check%20out%20FantasyTrack&body=Join%20me%20on%20FantasyTrack%20%E2%80%94%20a%20free-to-play%20player%20performance%20market."
                className="inline-flex items-center text-xs font-semibold text-amber-300 hover:text-amber-200"
              >
                Invite via email
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
