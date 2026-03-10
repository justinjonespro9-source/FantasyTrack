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
import { LiveRaceBoard } from "@/components/live-race-board";
import { formatCoins, formatDateTime, formatOddsTo1 } from "@/lib/format";

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

export default async function ContestPage({ params }: PageProps) {
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;

  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    include: {
      lanes: true,
      series: { select: { id: true, name: true } },
    },
  });

  if (!contest) notFound();

  const isSettled = contest.status === ContestStatus.SETTLED;
  const isAdmin = Boolean(session?.user?.isAdmin);

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
    }));

    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-track-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-track-900">{contest.title}</h1>
              <p className="mt-1 text-sm text-track-600">
                {contest.series?.name ? `${contest.series.name} · ` : ""}
                {contest.sport} · Settled{" "}
                <span className="font-medium">
                  {formatDateTime((contest as any).settledAt ?? contest.startTime)}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ShareContestButton contestId={contest.id} contestTitle={contest.title} />
              <Link
                href="/how-to-play"
                className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
              >
                How to Play
              </Link>

              {contest.series?.id ? (
                <Link
                  href={`/series/${contest.series.id}/leaderboard`}
                  className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                >
                  Series leaderboard
                </Link>
              ) : null}

              <span className="rounded bg-track-100 px-2 py-1 text-xs font-semibold text-track-700">
                SETTLED
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-track-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-track-900">Final race board</h2>
            <p className="text-sm text-track-600">
              Locked odds, pool totals, and final podium order.
            </p>
          </div>

          <SettledRaceBoard rows={settledRows} />
        </section>

        <section className="rounded-lg border border-track-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-track-900">My bets & payouts</h2>
            {userId ? (
              <div className="text-sm text-track-700">
                Total payout: <span className="font-semibold">{formatCoins(totalPayout)}</span>
              </div>
            ) : (
              <div className="text-sm text-track-600">Log in to see your bets.</div>
            )}
          </div>

          {userId && myTickets.length === 0 ? (
            <p className="mt-2 text-sm text-track-600">No tickets for you in this contest.</p>
          ) : null}

          {userId && myTickets.length > 0 ? (
            <div className="mt-3 space-y-3">
              {myTickets.map((t: any) => {
                const legs = t.legs ?? [];
                const stake = t.stakeAmount ?? 0;
                const ticketPayout = t.payoutAmount ?? null;
                const ticketNet = t.netAmount ?? null;

                return (
                  <div key={t.id} className="rounded border border-track-200 bg-track-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-track-900">
                          Total wager: {formatCoins(stake)}
                          {t.status ? (
                            <span className="text-xs text-track-600"> · {t.status}</span>
                          ) : null}
                          {t.result ? (
                            <span className="text-xs text-track-600"> · {t.result}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-track-500">
                          Wagered: {formatDateTime((t.placedAt ?? t.createdAt) as Date)}
                        </p>
                      </div>

                      <div className="min-w-[170px] text-right text-sm text-track-700">
                        {ticketPayout != null ? (
                          <>
                            Payout: <span className="font-semibold">{formatCoins(ticketPayout)}</span>
                            {ticketNet != null ? (
                              <>
                                {" "}
                                · Net: <span className="font-semibold">{formatCoins(ticketNet)}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-track-600">
                            Payout shown in profile (ticket fields not present).
                          </span>
                        )}
                      </div>
                    </div>

                    {legs.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded border border-track-200 bg-white">
                        <table className="w-full table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-[58%]" />
                            <col className="w-[18%]" />
                            <col className="w-[24%]" />
                          </colgroup>

                          <thead className="bg-track-50 text-track-600">
                            <tr>
                              <th className="px-3 py-2 font-medium">Lane</th>
                              <th className="px-3 py-2 font-medium">Market</th>
                              <th className="px-3 py-2 text-right font-medium">Wager amount</th>
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
                                leg.market === "WIN" && leg.oddsTo1Snap != null
                                  ? formatOddsTo1(leg.oddsTo1Snap)
                                  : null;

                              const refunded = leg.lane?.status === "SCRATCHED";

                              return (
                                <tr key={leg.id} className="border-t border-track-100 align-top">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={refunded ? "text-track-500 line-through" : undefined}
                                      >
                                        {leg.lane?.name ?? leg.laneNameSnap ?? "—"}
                                      </span>

                                      {oddsLabel ? (
                                        <span className="rounded bg-track-100 px-2 py-0.5 text-xs font-semibold text-track-700">
                                          {oddsLabel}
                                        </span>
                                      ) : null}

                                      {refunded ? (
                                        <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
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
                                      className={refunded ? "text-track-500 line-through" : undefined}
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
                      <p className="mt-2 text-sm text-track-600">No legs found for this ticket.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {userId && myPayoutTxs.length > 0 ? (
            <div className="mt-4 rounded border border-track-200 bg-white p-3">
              <p className="text-sm font-semibold text-track-800">Payout transactions</p>
              <ul className="mt-2 space-y-1 text-sm text-track-700">
                {myPayoutTxs.map((tx: any) => (
                  <li key={tx.id} className="flex items-center justify-between gap-2">
                    <span className="text-track-600">{formatDateTime(tx.createdAt as Date)}</span>
                    <span className="font-medium">{formatCoins(tx.amount ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <ScoringRulesCard sport={contest.sport} />

        {isAdmin ? (
          <section className="rounded-lg border border-track-200 bg-white p-4">
            <p className="text-sm text-track-600">
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
      <ContestBoard
        contestId={contest.id}
        title={contest.title}
        startTime={contest.startTime.toISOString()}
        endTime={((contest as any).endTime ?? contest.startTime).toISOString()}
        status={contest.status}
        lanes={contest.lanes}
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
      />

      <LiveRaceBoard
        contestId={contest.id}
        title={contest.title}
        lanes={contest.lanes.map((lane: any) => ({
          id: lane.id,
          name: lane.name,
          team: lane.team ?? null,
          position: lane.position ?? null,
          fantasyPoints: lane.fantasyPoints ?? null,
          status: lane.status,
        }))}
      />

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
        <p className="text-sm text-neutral-300">
          <span className="font-medium text-amber-200">Scratched players:</span> remain visible but
          cannot be wagered. Any wagers already placed on a scratched player are voided and refunded.
          If you already met the contest entry requirement, your entry remains valid. Refunded funds
          may be reallocated before lock if time remains.
        </p>
      </section>

      <ContestLiveTape contestId={contest.id} />

      <ContestMessageBoard
        contestId={contest.id}
        revalidatePath={`/contest/${contest.id}`}
      />

      <ScoringRulesCard sport={contest.sport} />
    </div>
  );
}