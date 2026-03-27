import { notFound } from "next/navigation";
import Link from "next/link";
import { ContestStatus, TransactionType } from "@prisma/client";
import ContestBoard from "@/components/contest/contest-board";
import { ShareContestButton } from "@/components/contest/share-contest-button";
import { ContestMessageBoard } from "@/components/contest-message-board";
import { ScoringRulesCard } from "@/components/scoring-rules-card";
import { getContestOddsData } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { ContestLiveTape } from "@/components/contest-live-tape";
import { getCurrentSession } from "@/lib/session";
import { SettledRaceBoard } from "@/components/settled-race-board";
import { formatCoins, formatDateTime, formatOpeningWinOddsCaption } from "@/lib/format";
import { formatSportLabel } from "@/lib/sports";
import { formatTrackConditionsLabel } from "@/lib/track-conditions";
import { BuildLanesAllPlayersButton } from "@/components/admin/build-lanes-all-players-button";
import { getBasketballScoringBreakdown } from "@/lib/scoring-config";
import { canUserAccessSeriesById } from "@/lib/series-access";

type PageProps = {
  params: { id: string };
};

function marketBadgeClass(market: string) {
  switch (market) {
    case "WIN":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    case "PLACE":
      return "border-sky-300 bg-sky-100 text-sky-800";
    case "SHOW":
      return "border-amber-300 bg-amber-100 text-amber-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

function computeTicketProfit(stake: number, payout: number | null | undefined): number | null {
  if (payout == null) return null;
  return payout - stake;
}

function computeTicketRoi(stake: number, profit: number | null): number | null {
  if (!stake || stake <= 0 || profit == null) return null;
  return profit / stake;
}

export default async function ContestPage({ params }: PageProps) {
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      lanes: true,
      series: { select: { id: true, name: true, isPrivate: true } },
    },
  });

  if (!contest) notFound();
  const seriesAccess = await canUserAccessSeriesById({
    seriesId: contest.series.id,
    userId,
    isAdmin: Boolean(session?.user?.isAdmin),
  });
  if (!seriesAccess.canAccess) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Private series
          </p>
          <h1 className="mt-2 text-xl font-semibold text-neutral-50">This contest is invite-only</h1>
          <p className="mt-3 text-sm text-neutral-400">
            {contest.title ? (
              <>
                <span className="text-neutral-300">“{contest.title}”</span> is part of{" "}
              </>
            ) : (
              "This contest is part of "
            )}
            {contest.series?.name ? (
              <span className="font-medium text-neutral-200">{contest.series.name}</span>
            ) : (
              "a private, invite-only series"
            )}
            . Join the series with an invite code to view contests and enter.
          </p>
          {!userId ? (
            <p className="mt-2 text-sm text-neutral-500">
              <Link href="/auth/login" className="text-amber-200 underline hover:text-amber-100">
                Sign in
              </Link>{" "}
              if you already belong to this series.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/series/join"
              className="rounded-full border border-amber-400/70 bg-amber-400 px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300"
            >
              Join with code
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-neutral-600 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 hover:border-amber-400/60"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSettled = contest.status === ContestStatus.SETTLED;
  const isAdmin = Boolean(session?.user?.isAdmin);

  const statusLabelMap: Record<string, string> = {
    [ContestStatus.DRAFT]: "Not Open",
    [ContestStatus.PUBLISHED]: "Open",
    [ContestStatus.LOCKED]: "Locked",
    [ContestStatus.SETTLED]: "Settled",
    ARCHIVED: "Archived",
  };

  const statusHelpTextMap: Record<string, string> = {
    [ContestStatus.DRAFT]: "This contest is not yet open for entry.",
    [ContestStatus.PUBLISHED]: "You can enter and place bets until lock.",
    [ContestStatus.LOCKED]: "Entries are closed. You can still track the live race.",
    [ContestStatus.SETTLED]:
      "Official results are posted. Review final standings and payouts.",
    ARCHIVED: "This contest is no longer active.",
  };

  const statusLabel = statusLabelMap[contest.status] ?? contest.status;
  const statusHelp = statusHelpTextMap[contest.status] ?? "";

  // -----------------------------
  // SETTLED MODE
  // Results page only: leaderboard + your bets/payouts
  // -----------------------------
  if (isSettled) {
    const settledOdds = await getContestOddsData(contest.id, userId ?? undefined);
    if (!settledOdds) notFound();

    const lanesByFinalRank = [...contest.lanes].sort((a: any, b: any) => {
      const ar = a.finalRank ?? 9999;
      const br = b.finalRank ?? 9999;
      if (ar !== br) return ar - br;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    const myTickets = userId
      ? await prisma.ticket.findMany({
          where: { userId, contestId: contest.id },
          orderBy: { placedAt: "desc" },
          take: 200,
          include: {
            legs: {
              orderBy: { id: "asc" },
              include: {
                lane: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
                transactions: {
                  where: {
                    OR: [{ type: TransactionType.BET }, { type: TransactionType.PAYOUT }],
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        })
      : [];

    const myPayoutTxs = userId
      ? await prisma.transaction.findMany({
          where: { userId, contestId: contest.id, type: TransactionType.PAYOUT },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const totalPayout = myPayoutTxs.reduce(
      (sum: number, tx: any) => sum + (tx.amount ?? 0),
      0
    );

    const winningTicketsRaw = await prisma.ticket.findMany({
      where: {
        contestId: contest.id,
        payoutAmount: { gt: 0 },
      },
      orderBy: [{ payoutAmount: "desc" }, { placedAt: "asc" }],
      include: {
        user: { select: { id: true, displayName: true } },
        legs: {
          orderBy: { id: "asc" },
          include: {
            lane: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    const winningTickets = winningTicketsRaw.map((t: any) => {
      const stake = t.stakeAmount ?? 0;
      const payout = t.payoutAmount ?? 0;
      const profit = computeTicketProfit(stake, payout) ?? 0;
      const roi = computeTicketRoi(stake, profit);
      const multiple = stake > 0 ? payout / stake : null;
      const legs = Array.isArray(t.legs) ? t.legs : [];
      const markets = Array.from(new Set(legs.map((leg: any) => String(leg.market ?? "—"))));
      return {
        id: t.id,
        userId: t.userId,
        displayName: t.user?.displayName ?? "Unknown",
        stake,
        payout,
        profit,
        roi,
        multiple,
        placedAt: t.placedAt as Date,
        result: t.result ?? null,
        markets,
        legs: legs.map((leg: any) => ({
          id: leg.id,
          market: String(leg.market ?? "—"),
          laneName: leg.lane?.name ?? leg.laneNameSnap ?? "—",
          refunded: leg.lane?.status === "SCRATCHED",
        })),
      };
    });

    const winningTicketCount = winningTickets.length;
    const biggestPayoutTicket =
      winningTickets.length > 0
        ? winningTickets.reduce((best, t) => (t.payout > best.payout ? t : best), winningTickets[0])
        : null;
    const bestRoiTicket =
      winningTickets.length > 0
        ? winningTickets.reduce((best, t) => {
            const bestRoi = best.roi ?? -Infinity;
            const nextRoi = t.roi ?? -Infinity;
            return nextRoi > bestRoi ? t : best;
          }, winningTickets[0])
        : null;
    const marketWinCounts = new Map<string, number>();
    for (const t of winningTickets) {
      for (const m of t.markets) {
        const market = String(m);
        marketWinCounts.set(market, (marketWinCounts.get(market) ?? 0) + 1);
      }
    }
    const mostCommonWinningMarket =
      marketWinCounts.size > 0
        ? [...marketWinCounts.entries()].sort((a, b) => b[1] - a[1])[0]
        : null;

    const settledRows = lanesByFinalRank.map((lane: any) => ({
      id: lane.id,
      name: lane.name,
      team: lane.team,
      position: lane.position,
      status: lane.status,
      finalRank: lane.finalRank,
      fantasyPoints: lane.fantasyPoints,
      openingWinOddsTo1: lane.openingWinOddsTo1,

      winTotal: settledOdds.laneTotals[lane.id]?.WIN ?? 0,
      placeTotal: settledOdds.laneTotals[lane.id]?.PLACE ?? 0,
      showTotal: settledOdds.laneTotals[lane.id]?.SHOW ?? 0,

      winMultiple: settledOdds.estMultiples[lane.id]?.WIN ?? null,
      placeMultiple: settledOdds.estMultiples[lane.id]?.PLACE ?? null,
      showMultiple: settledOdds.estMultiples[lane.id]?.SHOW ?? null,

      scoringBreakdown:
        contest.sport === "BASKETBALL"
          ? getBasketballScoringBreakdown({
              points: lane.basketballPoints ?? 0,
              rebounds: lane.basketballRebounds ?? 0,
              assists: lane.basketballAssists ?? 0,
              steals: lane.basketballSteals ?? 0,
              blocks: lane.basketballBlocks ?? 0,
              turnovers: lane.basketballTurnovers ?? 0,
              threePointersMade: lane.basketballThreesMade ?? 0,
            })
          : undefined,
    }));

    const sportLabel = formatSportLabel(contest.sport as any);
    const trackConditionsCode = (contest as any).trackConditions as string | null | undefined;
    const trackConditionsLabel = formatTrackConditionsLabel(trackConditionsCode);

    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-amber-300">{contest.title}</h1>
              <p className="mt-1 text-sm text-neutral-300">
                {contest.series?.name ? `${contest.series.name} · ` : ""}
                Settled{" "}
                <span className="font-medium text-neutral-100">
                  {formatDateTime((contest as any).settledAt ?? contest.startTime)}
                </span>
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {contest.series?.isPrivate ? (
                  <span className="rounded-full border border-violet-400/50 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                    Invite only
                  </span>
                ) : null}
                <span className="rounded-full border border-neutral-700 bg-neutral-950/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-100">
                  {sportLabel}
                </span>
                <span className="rounded-full border border-neutral-700 bg-neutral-950/80 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-100">
                  Track Conditions: {trackConditionsLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShareContestButton contestId={contest.id} contestTitle={contest.title} />
              <Link
                href="/how-to-play"
                className="rounded-full border border-neutral-600 bg-neutral-900 px-3 py-1 text-sm text-neutral-100 hover:border-amber-400 hover:text-amber-300"
              >
                How to Play
              </Link>

              {contest.series?.id ? (
                <Link
                  href={`/series/${contest.series.id}`}
                  className="rounded-full border border-neutral-600 bg-neutral-900 px-3 py-1 text-sm text-neutral-100 hover:border-amber-400 hover:text-amber-300"
                >
                  Series hub
                </Link>
              ) : null}

              <span className="rounded-full border border-amber-400/80 bg-amber-500/20 px-2 py-1 text-xs font-semibold tracking-wide text-amber-100">
                SETTLED
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {contest.series?.isPrivate ? (
                <span className="inline-flex items-center rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                  Invite only
                </span>
              ) : null}
              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  contest.status === ContestStatus.PUBLISHED &&
                    "border-emerald-400/70 bg-emerald-500/10 text-emerald-200",
                  contest.status === ContestStatus.LOCKED &&
                    "border-amber-400/70 bg-amber-500/10 text-amber-200",
                  contest.status === ContestStatus.SETTLED &&
                    "border-neutral-500/70 bg-neutral-800/80 text-neutral-100",
                  contest.status === ContestStatus.DRAFT &&
                    "border-neutral-600/70 bg-neutral-900/80 text-neutral-200",
                  (contest.status as any) === "ARCHIVED" &&
                    "border-neutral-700/70 bg-neutral-900/80 text-neutral-300",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {statusLabel}
              </span>
              <p className="text-xs text-neutral-200">{statusHelp}</p>
            </div>

            {contest.series?.name && (
              <p className="text-[11px] text-neutral-400">
                Counts toward{" "}
                <span className="font-semibold text-neutral-100">
                  {contest.series.name}
                </span>{" "}
                leaderboard.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-neutral-50">Final race board</h2>
            <p className="text-sm text-neutral-300">
              Locked odds, pool totals, and final podium order.
            </p>
          </div>

          <SettledRaceBoard rows={settledRows} />
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-neutral-50">Winner&apos;s Circle</h2>
            <p className="text-sm text-neutral-300">
              See who cashed in this race and what tickets paid.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Winning Tickets</p>
              <p className="mt-1 text-lg font-semibold text-neutral-50">{winningTicketCount}</p>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Biggest Payout</p>
              <p className="mt-1 text-sm text-neutral-100">
                {biggestPayoutTicket ? (
                  <>
                    {formatCoins(biggestPayoutTicket.payout)} · {biggestPayoutTicket.displayName}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Best ROI</p>
              <p className="mt-1 text-sm text-neutral-100">
                {bestRoiTicket && bestRoiTicket.roi != null ? (
                  <>
                    {(bestRoiTicket.roi * 100).toFixed(1)}% · {bestRoiTicket.displayName}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Most Hit Market</p>
              <p className="mt-1 text-sm text-neutral-100">
                {mostCommonWinningMarket ? (
                  <>
                    {mostCommonWinningMarket[0]} ({mostCommonWinningMarket[1]})
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          {winningTickets.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">No winning tickets recorded for this contest.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-neutral-800 bg-neutral-950">
              <p className="border-b border-neutral-800 px-3 py-2 text-[11px] text-neutral-500 sm:hidden">
                Swipe to view full winner details.
              </p>
              <table className="w-full min-w-[980px] text-left text-sm text-neutral-100">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">User</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Bet Type</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Selections</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">Stake</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">Payout</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">Profit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">ROI</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {winningTickets.map((t) => {
                    const isBiggestPayout = biggestPayoutTicket?.id === t.id;
                    const isBestRoi = bestRoiTicket?.id === t.id && t.roi != null;
                    return (
                    <tr
                      key={t.id}
                      className={[
                        "border-t border-neutral-800 align-top",
                        isBiggestPayout ? "bg-emerald-500/5" : "",
                        !isBiggestPayout && isBestRoi ? "bg-amber-500/5" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-neutral-50">{t.displayName}</span>
                          {isBiggestPayout ? (
                            <span className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                              Biggest Payout
                            </span>
                          ) : null}
                          {isBestRoi ? (
                            <span className="rounded-full border border-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                              Best ROI
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-neutral-500">{formatDateTime(t.placedAt)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {t.markets.map((m) => {
                            const market = String(m);
                            return (
                            <span
                              key={`${t.id}-${market}`}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none ${marketBadgeClass(
                                market
                              )}`}
                            >
                              {market}
                            </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <ul className="space-y-1">
                          {t.legs.map((leg: any) => (
                            <li key={leg.id} className={leg.refunded ? "text-neutral-500 line-through" : ""}>
                              {leg.laneName} <span className="text-neutral-500">({leg.market})</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCoins(t.stake)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCoins(t.payout)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCoins(t.profit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.roi != null ? `${(t.roi * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.multiple != null ? `${t.multiple.toFixed(2)}x` : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-50">My bets & payouts</h2>
            {userId ? (
              <div className="text-sm text-neutral-300">
                Total payout: <span className="font-semibold text-neutral-50">{formatCoins(totalPayout)}</span>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">Log in to see your bets.</div>
            )}
          </div>

          {userId && myTickets.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">No tickets for you in this contest.</p>
          ) : null}

          {userId && myTickets.length > 0 ? (
            <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto overscroll-contain pr-1">
              {myTickets.map((t: any) => {
                const legs = t.legs ?? [];
                const stake = t.stakeAmount ?? 0;
                const ticketPayout = t.payoutAmount ?? null;
                const ticketNet = t.netAmount ?? null;

                return (
                  <div
                    key={t.id}
                    className="rounded border border-neutral-800 bg-neutral-900/80 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-100">
                          Total wager: {formatCoins(stake)}
                          {t.status ? (
                            <span className="text-xs text-neutral-400"> · {t.status}</span>
                          ) : null}
                          {t.result ? (
                            <span className="text-xs text-neutral-400"> · {t.result}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-neutral-500">
                          Wagered: {formatDateTime((t.placedAt ?? t.createdAt) as Date)}
                        </p>
                      </div>

                      <div className="min-w-[170px] text-right text-sm text-neutral-300">
                        {ticketPayout != null ? (
                          <>
                            Payout:{" "}
                            <span className="font-semibold text-neutral-50">
                              {formatCoins(ticketPayout)}
                            </span>
                            {ticketNet != null ? (
                              <>
                                {" "}
                                · Net:{" "}
                                <span className="font-semibold text-neutral-50">
                                  {formatCoins(ticketNet)}
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-neutral-400">
                            Payout shown in profile (ticket fields not present).
                          </span>
                        )}
                      </div>
                    </div>

                    {legs.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded border border-neutral-800 bg-neutral-950">
                        <table className="w-full table-fixed text-left text-sm text-neutral-100">
                          <colgroup>
                            <col className="w-[58%]" />
                            <col className="w-[18%]" />
                            <col className="w-[24%]" />
                          </colgroup>

                          <thead className="bg-neutral-900 text-neutral-400">
                            <tr>
                              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                                Lane
                              </th>
                              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                                Market
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">
                                Wager amount
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {legs.map((leg: any) => {
                              const betAmount =
                                leg.transactions?.reduce(
                                  (sum: number, tx: any) => sum + Math.abs(tx.amount ?? 0),
                                  0
                                ) ?? null;

                              const fallbackPerLeg = Math.floor(stake / (legs.length || 1));

                              const oddsLabel =
                                leg.market === "WIN"
                                  ? formatOpeningWinOddsCaption(leg.oddsTo1Snap)
                                  : null;

                              const refunded = leg.lane?.status === "SCRATCHED";

                              return (
                                <tr key={leg.id} className="border-t border-neutral-800 align-top">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={
                                          refunded ? "text-neutral-500 line-through" : undefined
                                        }
                                      >
                                        {leg.lane?.name ?? leg.laneNameSnap ?? "—"}
                                      </span>

                                      {oddsLabel ? (
                                        <span className="rounded border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
                                          {oddsLabel}
                                        </span>
                                      ) : null}

                                      {refunded ? (
                                        <span className="rounded border border-red-500/70 bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-200">
                                          Refunded
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none ${marketBadgeClass(
                                        leg.market ?? ""
                                      )}`}
                                    >
                                      {leg.market ?? "—"}
                                    </span>
                                  </td>

                                  <td className="px-3 py-2 text-right">
                                    <span
                                      className={
                                        refunded ? "text-neutral-500 line-through" : undefined
                                      }
                                    >
                                      {formatCoins(betAmount ?? fallbackPerLeg)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-400">
                        No legs found for this ticket.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {userId && myPayoutTxs.length > 0 ? (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900/80 p-3">
              <p className="text-sm font-semibold text-neutral-100">Payout transactions</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                {myPayoutTxs.map((tx: any) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">
                      {formatDateTime(tx.createdAt as Date)}
                    </span>
                    <span className="font-medium text-neutral-100">
                      {formatCoins(tx.amount ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <ScoringRulesCard sport={contest.sport} />

        {isAdmin ? (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
            <p className="text-sm text-neutral-300">
              Admin: this contest is settled. If you need to correct results, use the Admin page to
              Reopen (Edit) and resettle.
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  // -----------------------------
  // LIVE / OPEN MODE
  // -----------------------------
  const odds = await getContestOddsData(contest.id, userId ?? undefined);
  if (!odds) notFound();

  const myTickets = userId
    ? await prisma.ticket.findMany({
        where: { userId, contestId: contest.id },
        orderBy: { placedAt: "desc" },
        take: 200,
        include: {
          legs: {
            orderBy: { id: "asc" },
            include: {
              lane: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
              transactions: {
                where: { type: TransactionType.BET },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {contest.series?.isPrivate ? (
                  <span className="inline-flex items-center rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                    Invite only
                  </span>
                ) : null}
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    contest.status === ContestStatus.PUBLISHED &&
                      "border-emerald-400/70 bg-emerald-500/10 text-emerald-200",
                    contest.status === ContestStatus.LOCKED &&
                      "border-amber-400/70 bg-amber-500/10 text-amber-200",
                    contest.status === ContestStatus.SETTLED &&
                      "border-neutral-500/70 bg-neutral-800/80 text-neutral-100",
                    contest.status === ContestStatus.DRAFT &&
                      "border-neutral-600/70 bg-neutral-900/80 text-neutral-200",
                    (contest.status as any) === "ARCHIVED" &&
                      "border-neutral-700/70 bg-neutral-900/80 text-neutral-300",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {statusLabel}
                </span>
                <p className="text-xs text-neutral-200">{statusHelp}</p>
              </div>

              {contest.series?.name && (
                <p className="text-[11px] text-neutral-400">
                  Counts toward{" "}
                  <span className="font-semibold text-neutral-100">
                    {contest.series.name}
                  </span>{" "}
                  leaderboard.
                </p>
              )}
            </div>
          </section>

          <ContestBoard
            contestId={contest.id}
            title={contest.title}
            startTime={contest.startTime.toISOString()}
            endTime={((contest as any).endTime ?? contest.startTime).toISOString()}
            sport={contest.sport}
            trackConditions={(contest as any).trackConditions ?? null}
            status={contest.status}
            lanes={contest.lanes.map((lane: any) => ({
              id: lane.id,
              name: lane.name,
              team: lane.team,
              position: lane.position,
              finalRank: lane.finalRank,
              openingWinOddsTo1: lane.openingWinOddsTo1,
              fantasyPoints: lane.fantasyPoints,
              liveFantasyPoints: lane.liveFantasyPoints,
              status: lane.status,
              scoringBreakdown:
                contest.sport === "BASKETBALL"
                  ? getBasketballScoringBreakdown({
                      points: lane.basketballPoints ?? 0,
                      rebounds: lane.basketballRebounds ?? 0,
                      assists: lane.basketballAssists ?? 0,
                      steals: lane.basketballSteals ?? 0,
                      blocks: lane.basketballBlocks ?? 0,
                      turnovers: lane.basketballTurnovers ?? 0,
                      threePointersMade: lane.basketballThreesMade ?? 0,
                    })
                  : undefined,
            }))}
            initialOdds={odds}
            initialMyBets={myTickets.flatMap((t: any) => {
              const legs = t.legs ?? [];
              const legCount = legs.length || 1;
              const perLegAmount = Math.floor((t.stakeAmount ?? 0) / legCount);
              const createdAt = (t.placedAt ?? t.createdAt).toISOString();

              return legs.map((leg: any) => {
                const payout = (leg.transactions ?? [])
                  .filter((tx: any) => tx.type === TransactionType.PAYOUT)
                  .reduce((sum: number, tx: any) => sum + (tx.amount ?? 0), 0);

                return {
                  id: leg.id,
                  ticketId: t.id ?? null,
                  laneId: leg.lane?.id ?? leg.laneId,
                  laneName: leg.lane?.name ?? leg.laneNameSnap ?? "—",
                  market: leg.market,
                  amount: perLegAmount,
                  createdAt,
                  refunded: leg.lane?.status === "SCRATCHED",
                  payout,
                };
              });
            })}
            isLoggedIn={Boolean(userId)}
            isAdmin={isAdmin}
            liveGameProgress={(contest as any).liveGameProgress ?? undefined}
            liveGameStatus={(contest as any).liveGameStatus ?? undefined}
          />

          <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
            <p className="text-sm text-neutral-300">
              <span className="font-medium text-amber-200">Scratched players:</span> remain visible
              but cannot be wagered. Any wagers already placed on a scratched player are voided and
              refunded. If you already met the contest entry requirement, your entry remains valid.
              Refunded funds may be reallocated before lock if time remains.
            </p>
          </section>

          {isAdmin &&
          contest.sport === "BASKETBALL" &&
          (contest as { homeTeamId?: string | null; awayTeamId?: string | null }).homeTeamId &&
          (contest as { homeTeamId?: string | null; awayTeamId?: string | null }).awayTeamId ? (
            <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
                Admin — lanes
              </p>
              <BuildLanesAllPlayersButton
                contestId={contest.id}
                sport={contest.sport}
                homeTeamId={(contest as { homeTeamId?: string | null }).homeTeamId ?? null}
                awayTeamId={(contest as { awayTeamId?: string | null }).awayTeamId ?? null}
              />
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {/* Mobile: secondary sections as accordions */}
          <div className="space-y-3 lg:hidden">
            <details className="rounded-lg border border-neutral-800 bg-neutral-900/80">
              <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-neutral-100">
                Live Tape
              </summary>
              <div className="border-t border-neutral-800 px-4 py-3">
                <ContestLiveTape contestId={contest.id} />
              </div>
            </details>

            <details className="rounded-lg border border-neutral-800 bg-neutral-900/80">
              <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-neutral-100">
                Message Board
              </summary>
              <div className="border-t border-neutral-800 px-4 py-3">
                <ContestMessageBoard
                  contestId={contest.id}
                  revalidatePath={`/contest/${contest.id}`}
                />
              </div>
            </details>

            <details className="rounded-lg border border-neutral-800 bg-neutral-900/80">
              <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-neutral-100">
                Scoring Rules
              </summary>
              <div className="border-t border-neutral-800 px-4 py-3">
                <ScoringRulesCard sport={contest.sport} />
              </div>
            </details>
          </div>

          {/* Desktop: full secondary column */}
          <div className="hidden space-y-4 lg:block">
            <ContestLiveTape contestId={contest.id} />

            <ContestMessageBoard
              contestId={contest.id}
              revalidatePath={`/contest/${contest.id}`}
            />

            <ScoringRulesCard sport={contest.sport} />
          </div>
        </div>
      </div>
    </div>
  );
}