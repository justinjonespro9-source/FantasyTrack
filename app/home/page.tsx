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

const heroBadge =
  "inline-flex flex-col items-center rounded-full border border-ft-gold/45 bg-black/40 px-4 py-1.5 text-center shadow-inner backdrop-blur-sm";

export default function FantasyTrackHomePage() {
  return (
    <div className="text-neutral-100">
      <main className="mx-auto max-w-6xl space-y-10 sm:space-y-12">
        {/* Hero */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center lg:gap-10">
          {/* Left: text */}
          <div className="max-w-lg space-y-6">
            <div className="flex justify-center sm:justify-start">
              <div className={heroBadge}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-ft-gold">
                  Now in free beta · Test coins
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Hockey · Basketball · Baseball · Golf
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-[2.15rem]">
                Player performance market
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
                FantasyTrack turns athlete performance into a live race. Pick your runners, track the
                fantasy leaderboard, and win when your ticket finishes on the podium.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-ft-cta px-6 py-2.5 text-sm font-bold text-neutral-950 shadow-ft-inner transition duration-ft hover:brightness-110 active:scale-[0.98] ft-focus-ring"
              >
                Enter the track
              </Link>
              <Link
                href="/how-to-play"
                className="rounded-full border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-neutral-200 transition duration-ft hover:border-ft-gold/35 hover:text-ft-gold ft-focus-ring"
              >
                How it works
              </Link>
            </div>
          </div>

          {/* Right: same settled board as real contest page — sample data only */}
          <section className="overflow-hidden rounded-ft-lg border border-white/[0.08] bg-gradient-to-b from-ft-charcoal/50 to-black/80 p-4 shadow-ft-card sm:p-5">
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
        <section className="grid gap-4 md:grid-cols-3 md:gap-5">
          <div className="ft-surface p-5">
            <p className="ft-label text-neutral-500">01</p>
            <h3 className="mt-2 text-sm font-bold text-neutral-50">Pick your runners</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Choose athletes competing in tonight&apos;s game. Each player earns fantasy points based
              on their real-game performance.
            </p>
          </div>

          <div className="ft-surface p-5">
            <p className="ft-label text-neutral-500">02</p>
            <h3 className="mt-2 text-sm font-bold text-neutral-50">Bet the race</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Back players to finish Win, Place, or Show as their fantasy points move them up the
              leaderboard.
            </p>
          </div>

          <div className="ft-surface p-5">
            <p className="ft-label text-neutral-500">03</p>
            <h3 className="mt-2 text-sm font-bold text-neutral-50">Watch the leaderboard</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              The race updates live as players accumulate fantasy scoring throughout the game.
            </p>
          </div>
        </section>

        {/* Community CTA strip above footer */}
        <section className="grid gap-4 text-xs text-neutral-300 sm:grid-cols-2 sm:gap-5">
          <div className="ft-surface p-5">
            <h2 className="text-sm font-bold text-neutral-50">Join the FantasyTrack Discord</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Join the official community for updates, contest talk, feedback, and early access news.
            </p>
            <div className="mt-3">
              <Link
                href="https://discord.gg/UYHWmy8j"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-bold text-ft-gold transition hover:text-ft-gold-bright ft-focus-ring rounded-sm"
              >
                Join our Discord →
              </Link>
            </div>
          </div>

          <div className="ft-surface p-5">
            <h2 className="text-sm font-bold text-neutral-50">Invite others</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Know someone who’d love FantasyTrack? Share it and help us build the field.
            </p>
            <div className="mt-3">
              <Link
                href="mailto:?subject=Check%20out%20FantasyTrack&body=Join%20me%20on%20FantasyTrack%20%E2%80%94%20a%20free-to-play%20player%20performance%20market."
                className="inline-flex items-center text-xs font-bold text-ft-gold transition hover:text-ft-gold-bright ft-focus-ring rounded-sm"
              >
                Invite via email →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
