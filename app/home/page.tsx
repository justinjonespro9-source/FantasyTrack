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
    winTotal: 0,
    placeTotal: 0,
    showTotal: 0,
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
    winTotal: 0,
    placeTotal: 0,
    showTotal: 0,
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
    winTotal: 0,
    placeTotal: 0,
    showTotal: 0,
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
    <div className="-mx-4 -my-6 min-h-[calc(100vh-5rem)] bg-neutral-950 px-4 py-10 text-neutral-100">
      {/* No duplicate header — top nav only from layout Nav */}

      <main className="mx-auto max-w-6xl">
        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          {/* Left: text */}
          <div className="space-y-6">
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
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
                Bet on Players Like a Race
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
                FantasyTrack is the first Player Performance Market. Pick athletes, watch the live
                leaderboard powered by fantasy scoring, and win when your runner finishes on the podium.
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
          <section className="rounded-lg border border-track-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-track-900">
                Super Bowl Player Performance Market
              </h2>
              <p className="mt-1 text-sm text-track-600">
                <span className="font-medium text-track-700">Track Conditions:</span> Dry / Sunny
              </p>
              <p className="mt-2 text-sm text-track-600">
                Final race board — same layout as a settled contest. Win / Place / Show from final
                ranks; sample pools shown as zero.
              </p>
            </div>
            <SettledRaceBoard rows={SAMPLE_SETTLED_ROWS} />
          </section>
        </section>

        {/* Feature cards */}
        <section className="mt-12 grid gap-4 md:grid-cols-3">
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
      </main>
    </div>
  );
}
