import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileTicketHistory from "../../components/profile/profile-ticket-history";
import ProfileTransactionHistory from "../../components/profile/profile-transaction-history";
import { formatCoins, formatDateTime } from "@/lib/format";
import { getUserWalletSummary } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ContestStatus, TransactionType } from "@prisma/client";
import { resolveProfileBadges } from "@/lib/badges";

function formatTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.BET:
      return "Bet";
    case TransactionType.PAYOUT:
      return "Payout";
    case TransactionType.VOID_REFUND:
      return "Refund";
    case TransactionType.GRANT:
      return "Bankroll Grant";
    case TransactionType.ADJUSTMENT:
      return "Adjustment";
    default:
      return type;
  }
}

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  const [user, wallet, tickets, transactions, ticketCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, phone: true },
    }),
    getUserWalletSummary(userId),

    prisma.ticket.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      take: 50,
      include: {
        contest: { select: { title: true } },
        legs: {
          orderBy: { id: "asc" },
          include: {
            lane: { select: { name: true, team: true, position: true, status: true } },
            transactions: {
              where: { type: TransactionType.BET },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    }),

    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        contest: { select: { title: true } },
      },
    }),
    prisma.ticket.count({
      where: { userId },
    }),
  ]);

  // Lifetime wagering & payout aggregates
  const [betAgg, payoutAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: TransactionType.BET },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: TransactionType.PAYOUT },
      _sum: { amount: true },
    }),
  ]);

  const totalWagered = Math.abs(betAgg._sum.amount ?? 0);
  const totalPayouts = payoutAgg._sum.amount ?? 0;
  const netProfitLoss = totalPayouts - totalWagered;
  const roiPercent = totalWagered > 0 ? (netProfitLoss / totalWagered) * 100 : null;

  // Contest-level stats (wins/podiums) based on per-contest net
  const allUserTickets = await prisma.ticket.findMany({
    where: { userId },
    select: { contestId: true },
  });

  const contestIds = Array.from(
    new Set(allUserTickets.map((t) => t.contestId).filter((id): id is string => Boolean(id)))
  );

  let totalContestsEntered = contestIds.length;
  let totalSettledContests = 0;
  let profitableContests = 0;
  let sumNetPerSettledContest = 0;

  if (contestIds.length > 0) {
    const [contestsForUser, txByContest] = await Promise.all([
      prisma.contest.findMany({
        where: { id: { in: contestIds } },
        select: { id: true, status: true },
      }),
      prisma.transaction.findMany({
        where: {
          contestId: { in: contestIds },
          type: {
            in: [TransactionType.BET, TransactionType.PAYOUT, TransactionType.VOID_REFUND],
          },
        },
        select: {
          contestId: true,
          userId: true,
          amount: true,
        },
      }),
    ]);

    const netByContestAndUser: Record<string, Map<string, number>> = {};

    for (const tx of txByContest) {
      if (!tx.contestId) continue;
      let map = netByContestAndUser[tx.contestId];
      if (!map) {
        map = new Map<string, number>();
        netByContestAndUser[tx.contestId] = map;
      }
      map.set(tx.userId, (map.get(tx.userId) ?? 0) + tx.amount);
    }

    for (const contest of contestsForUser) {
      if (contest.status !== ContestStatus.SETTLED) continue;

      const nets = netByContestAndUser[contest.id];
      if (!nets) continue;
      if (!nets.has(userId)) continue;

      totalSettledContests += 1;

      const userNet = nets.get(userId) ?? 0;
      sumNetPerSettledContest += userNet;
      if (userNet > 0) {
        profitableContests += 1;
      }
    }
  }

  const profitablePercent =
    totalSettledContests > 0 ? (profitableContests / totalSettledContests) * 100 : null;

  const averageNetPerSettledContest =
    totalSettledContests > 0 ? sumNetPerSettledContest / totalSettledContests : null;

  const formatPercent = (value: number | null) => {
    if (value == null) return "—";
    const rounded = value.toFixed(1).replace(/\.0$/, "");
    return `${rounded}%`;
  };

  if (!user) {
    redirect("/auth/login");
  }

  const badges = resolveProfileBadges({
    totalContestsEntered,
    totalSettledContests,
    profitableContests,
    totalWagered,
    netProfitLoss,
    roiPercent,
    ticketCount,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-lg font-semibold uppercase text-neutral-200 sm:h-24 sm:w-24">
              {user.displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-neutral-50">{user.displayName}</h1>
                <p className="mt-1 text-xs text-neutral-400">
                  {user.email}
                  {user.phone ? <> · {user.phone}</> : null}
                </p>
              </div>

              <div className="sm:text-right">
                <Link
                  href="/profile/edit"
                  className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-amber-300 hover:text-amber-200"
                >
                  Edit Profile
                </Link>
              </div>
            </div>

            {badges.length > 0 ? (
              <div className="mt-1 border-t border-neutral-800/80 pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                        {badge.label}
                        {badge.tier && badge.tier > 1 ? (
                          <span className="ml-1 text-[9px] font-normal text-amber-200/90">
                            · Lv{badge.tier}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-neutral-300">{badge.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
        <h2 className="text-base font-semibold text-neutral-50">Contest performance</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Contests entered
            </p>
            <p className="mt-1 text-xl font-semibold text-neutral-50">
              {totalContestsEntered}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Settled contests
            </p>
            <p className="mt-1 text-xl font-semibold text-neutral-50">
              {totalSettledContests}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Profitable contests
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {profitableContests}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Profitable contest %
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {formatPercent(profitablePercent)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Total wagered
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">
              {formatCoins(totalWagered)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Total payouts
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">
              {formatCoins(totalPayouts)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Net profit / loss
            </p>
            <p
              className={`mt-1 text-lg font-semibold ${
                netProfitLoss > 0
                  ? "text-emerald-300"
                  : netProfitLoss < 0
                    ? "text-red-300"
                    : "text-neutral-50"
              }`}
            >
              {netProfitLoss > 0 ? `+${formatCoins(netProfitLoss)}` : formatCoins(netProfitLoss)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              ROI
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">
              {formatPercent(roiPercent)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Avg net / settled contest
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-50">
              {averageNetPerSettledContest == null
                ? "—"
                : formatCoins(averageNetPerSettledContest)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
        <h2 className="text-base font-semibold text-neutral-50">Account snapshot</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Balance
            </p>
            <p className="mt-1 text-xl font-semibold text-neutral-50">
              {formatCoins(wallet.balance)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Total Bankroll Granted
            </p>
            <p className="mt-1 text-xl font-semibold text-neutral-50">
              {formatCoins(wallet.totalGranted)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Net
            </p>
            <p className="mt-1 text-xl font-semibold text-neutral-50">
              {formatCoins(wallet.net)}
            </p>
          </div>
        </div>
      </section>

      <ProfileTicketHistory tickets={tickets} />

      <ProfileTransactionHistory transactions={transactions} />
    </div>
  );
}
