import {
  ContestStatus,
  TransactionType,
  TicketStatus,
  TicketResult,
  LegResult,
  LaneStatus,
} from "@prisma/client";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { SPORTS, formatSportLabel, type SportKey } from "@/lib/sports";
import { formatCoins, formatDateTime, formatMultiple } from "@/lib/format";
import { autoLockContests, settleContestAtomic } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { ClientOnly } from "@/components/client-only";

// --------------------
// Helpers
// --------------------

function parseOpeningWinOddsTo1(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
    throw new Error("Opening WIN odds must be greater than 0 and at most 999.");
  }

  return parsed;
}

function CardSection({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-50">{title}</h2>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-3 text-sm text-neutral-200">{children}</div>
    </section>
  );
}

function SettledContestsSection({
  settled,
  reopenSettlementAction,
  toggleArchiveContestAction,
}: {
  settled: any[];
  reopenSettlementAction: (formData: FormData) => Promise<void>;
  toggleArchiveContestAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <CardSection title="Settled Contests (Editable)">
      <p className="text-sm text-track-600">
        Settled contests are locked-in for users, but admins can reopen a settlement to correct
        ranks/points and resettle.
      </p>

      {settled.length === 0 ? (
        <p className="mt-3 text-sm text-track-600">No settled contests.</p>
      ) : (
        <details className="mt-4">
          <summary className="cursor-pointer font-medium text-track-800">
            Settled contests ({settled.length})
          </summary>

          <div className="mt-3 space-y-3">
            {settled.map((contest) => {
              const summary = contest.settlementSummary;

              const ticketCount = contest.tickets?.length ?? 0;

              const handle = (contest.tickets ?? []).reduce(
                (sum: number, ticket: any) => sum + (ticket.stakeAmount ?? 0),
                0
              );

              const payouts = (contest.tickets ?? []).reduce(
                (sum: number, ticket: any) => sum + (ticket.payoutAmount ?? 0),
                0
              );

              const rake = summary
                ? (summary.winTakeoutTotal ?? 0) +
                  (summary.placeTakeoutTotal ?? 0) +
                  (summary.showTakeoutTotal ?? 0)
                : 0;

              const netHold = handle - payouts;
              const unpaidPoolRetained = netHold - rake;

              return (
                <div key={contest.id} className="rounded border border-track-200 bg-track-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{contest.title}</p>
                      <p className="text-sm text-track-600">
                        {contest.series?.name ?? "—"} · {contest.sport} ·{" "}
                        {formatDateTime(contest.startTime)} · {contest.status}
                      </p>

                      {contest.settledAt ? (
                        <p className="text-xs text-track-500">
                          Settled: {formatDateTime(contest.settledAt)}
                        </p>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-track-700 sm:grid-cols-6">
                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Tickets</p>
                          <p>{ticketCount}</p>
                        </div>

                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Handle</p>
                          <p>{formatCoins(handle)}</p>
                        </div>

                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Payouts</p>
                          <p>{formatCoins(payouts)}</p>
                        </div>

                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Rake</p>
                          <p>{formatCoins(rake)}</p>
                        </div>

                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Net Hold</p>
                          <p>{formatCoins(netHold)}</p>
                        </div>

                        <div className="rounded border border-track-200 bg-white p-2">
                          <p className="font-semibold text-track-900">Unpaid Pool Retained</p>
                          <p>{formatCoins(unpaidPoolRetained)}</p>
                        </div>
                      </div>

                      {summary ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-track-700 sm:grid-cols-3">
                          <div className="rounded border border-track-200 bg-white p-2">
                            <p className="font-semibold text-track-900">WIN</p>
                            <p>Gross: {formatCoins(summary.winPoolGross ?? 0)}</p>
                            <p>Rake: {formatCoins(summary.winTakeoutTotal ?? 0)}</p>
                            <p>Net: {formatCoins(summary.winPoolTotal ?? 0)}</p>
                            <p>Multiple: {formatMultiple(summary.winPayoutMultiple ?? 0)}</p>
                          </div>

                          <div className="rounded border border-track-200 bg-white p-2">
                            <p className="font-semibold text-track-900">PLACE</p>
                            <p>Gross: {formatCoins(summary.placePoolGross ?? 0)}</p>
                            <p>Rake: {formatCoins(summary.placeTakeoutTotal ?? 0)}</p>
                            <p>Net: {formatCoins(summary.placePoolTotal ?? 0)}</p>
                            <p>Multiple: {formatMultiple(summary.placePayoutMultiple ?? 0)}</p>
                          </div>

                          <div className="rounded border border-track-200 bg-white p-2">
                            <p className="font-semibold text-track-900">SHOW</p>
                            <p>Gross: {formatCoins(summary.showPoolGross ?? 0)}</p>
                            <p>Rake: {formatCoins(summary.showTakeoutTotal ?? 0)}</p>
                            <p>Net: {formatCoins(summary.showPoolTotal ?? 0)}</p>
                            <p>Multiple: {formatMultiple(summary.showPayoutMultiple ?? 0)}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/contest/${contest.id}`}
                        className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                      >
                        View
                      </Link>

                      <form action={reopenSettlementAction}>
                        <input type="hidden" name="contestId" value={contest.id} />
                        <button
                          type="submit"
                          className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                        >
                          Reopen (Edit)
                        </button>
                      </form>

                      <form action={toggleArchiveContestAction}>
                        <input type="hidden" name="contestId" value={contest.id} />
                        <input type="hidden" name="archived" value="true" />
                        <button
                          type="submit"
                          className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                        >
                          Archive
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </CardSection>
  );
}

function ArchivedContestsSection({
  archivedContests,
  toggleArchiveContestAction,
}: {
  archivedContests: any[];
  toggleArchiveContestAction: (formData: FormData) => Promise<void>;
}) {
  if (archivedContests.length === 0) return null;

  return (
    <CardSection title="Archived Contests">
      <details>
        <summary className="cursor-pointer font-medium text-track-800">
          Archived contests ({archivedContests.length})
        </summary>

        <div className="mt-3 space-y-3">
          {archivedContests.map((contest) => (
            <div key={contest.id} className="rounded border border-track-200 bg-track-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{contest.title}</p>
                  <p className="text-sm text-track-600">
                    {contest.series?.name ?? "—"} · {contest.sport} ·{" "}
                    {formatDateTime(contest.startTime)} · {contest.status}
                  </p>

                  {contest.archivedAt ? (
                    <p className="text-xs text-track-500">
                      Archived{" "}
                      <ClientOnly>
                        <span>{formatDateTime(contest.archivedAt)}</span>
                      </ClientOnly>
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/contest/${contest.id}`}
                    className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                  >
                    View
                  </Link>

                  <form action={toggleArchiveContestAction}>
                    <input type="hidden" name="contestId" value={contest.id} />
                    <input type="hidden" name="archived" value="false" />
                    <button
                      type="submit"
                      className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                    >
                      Unarchive
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    </CardSection>
  );
}


function AdminToolsGrid({
  users,
  seriesList,
  activeContests,
  shoutouts,
  grantCoinsAction,
  createShoutoutAction,
}: {
  users: any[];
  seriesList: any[];
  activeContests: any[];
  shoutouts: any[];
  grantCoinsAction: (formData: FormData) => Promise<void>;
  createShoutoutAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <CardSection title="Grants">
        <form action={grantCoinsAction} className="space-y-2">
          <select name="userId" required className="w-full">
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </select>

          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            placeholder={`Bankroll amount (${formatCoins(100)} example)`}
            required
            className="w-full"
          />
          <input name="note" placeholder="Note" className="w-full" />

          <button type="submit" className="rounded bg-track-800 px-3 py-1 text-white">
            Grant bankroll
          </button>
        </form>
      </CardSection>

      <CardSection title="Commish Notes">
        <form action={createShoutoutAction} className="space-y-2">
          <select name="seriesId" required className="w-full">
            <option value="">Select series</option>
            {seriesList.map((series) => (
              <option key={series.id} value={series.id}>
                {series.name}
              </option>
            ))}
          </select>

          <select name="contestId" className="w-full">
            <option value="">Optional contest</option>
            {activeContests.map((contest) => (
              <option key={contest.id} value={contest.id}>
                {contest.title}
              </option>
            ))}
          </select>

          <textarea name="message" required placeholder="Note" className="min-h-24 w-full" />

          <button type="submit" className="rounded bg-track-800 px-3 py-1 text-white">
            Post note
          </button>
        </form>

        <div className="mt-4 space-y-2 text-sm">
          {shoutouts.map((shoutout) => (
            <div key={shoutout.id} className="rounded border border-track-200 p-2">
              <p>{shoutout.message}</p>
              <p className="text-xs text-track-500">
                {shoutout.series.name}
                {shoutout.contest ? ` · ${shoutout.contest.title}` : ""}
                {` · ${formatDateTime(shoutout.createdAt)}`}
              </p>
            </div>
          ))}
        </div>
      </CardSection>
    </section>
  );
}

// --------------------
// Server Actions
// --------------------
async function requireAdmin() {
  const auth = await getCurrentSession();
  if (!auth?.user?.id || !auth.user.isAdmin) throw new Error("Unauthorized");
  return auth;
}

async function toggleArchiveContestAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const archived = String(formData.get("archived") ?? "false") === "true";
  if (!contestId) throw new Error("Missing contestId");

  await prisma.contest.update({
    where: { id: contestId },
    data: { archivedAt: archived ? new Date() : null },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function createSeriesAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const prizesText = String(formData.get("prizesText") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";

  if (!name || !startDate || !endDate) {
    throw new Error("Series name/start/end are required.");
  }

  await prisma.series.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      prizesText,
      isActive,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function toggleSeriesActiveAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const seriesId = String(formData.get("seriesId") ?? "");
  const active = String(formData.get("active") ?? "false") === "true";
  if (!seriesId) throw new Error("Missing seriesId");

  await prisma.series.update({
    where: { id: seriesId },
    data: { isActive: active },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function createContestAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const seriesId = String(formData.get("seriesId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawSport = String(formData.get("sport") ?? "").trim().toUpperCase();
  const startTime = String(formData.get("startTime") ?? "");
  const status = String(formData.get("status") ?? ContestStatus.DRAFT) as ContestStatus;

  if (!seriesId || !title || !rawSport || !startTime) {
    throw new Error("Contest series/title/sport/start time are required.");
  }

  if (!SPORTS.includes(rawSport as SportKey)) {
    throw new Error("Invalid sport selected.");
  }

  const sport = rawSport as SportKey;

  await prisma.contest.create({
    data: {
      seriesId,
      title,
      sport,
      startTime: new Date(startTime),
      status,
      publishedAt: status === ContestStatus.PUBLISHED ? new Date() : null,
      lockedAt: status === ContestStatus.LOCKED ? new Date() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function addLaneAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const team = String(formData.get("team") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const openingWinOddsTo1 = parseOpeningWinOddsTo1(formData.get("openingWinOddsTo1"));

  if (!contestId || !name || !team || !position) {
    throw new Error("Lane contest/name/team/position are required.");
  }

  await prisma.lane.create({
    data: { contestId, name, team, position, openingWinOddsTo1 },
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateLaneAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const team = String(formData.get("team") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const openingWinOddsTo1 = parseOpeningWinOddsTo1(formData.get("openingWinOddsTo1"));
  const liveFantasyPointsRaw = String(formData.get("liveFantasyPoints") ?? "").trim();
  const liveFantasyPoints =
    liveFantasyPointsRaw === "" ? null : Number.isNaN(Number(liveFantasyPointsRaw)) ? null : Number(liveFantasyPointsRaw);

  if (!laneId || !contestId || !name || !team || !position) {
    throw new Error("Lane id/contest/name/team/position are required.");
  }

  await prisma.lane.update({
    where: { id: laneId },
    // cast to any so this stays type-safe once Prisma client is regenerated with liveFantasyPoints
    data: { name, team, position, openingWinOddsTo1, liveFantasyPoints } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function setLaneStatusAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!laneId || !contestId || !status) {
    throw new Error("Missing laneId/contestId/status");
  }

  if (!Object.values(LaneStatus).includes(status as LaneStatus)) {
    throw new Error("Invalid lane status");
  }

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      status: status as LaneStatus,
      statusUpdatedAt: new Date(),
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function scratchLaneAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const note = String(formData.get("note") ?? "SCRATCHED") || "SCRATCHED";

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  await prisma.$transaction(async (tx) => {
    await tx.lane.update({
      where: { id: laneId },
      data: {
        status: LaneStatus.SCRATCHED,
        statusUpdatedAt: new Date(),
      },
    });

    const legs = await tx.ticketLeg.findMany({
      where: {
        contestId,
        laneId,
        isVoided: false,
      },
      select: {
        id: true,
        userId: true,
        ticketId: true,
      },
    });

    for (const leg of legs) {
      const betAgg = await tx.transaction.aggregate({
        where: {
          ticketLegId: leg.id,
          type: TransactionType.BET,
        },
        _sum: { amount: true },
      });

      const betSum = betAgg._sum.amount ?? 0;
      const refundAmount = Math.abs(betSum);

      await tx.ticketLeg.update({
        where: { id: leg.id },
        data: {
          isVoided: true,
          voidReason: "SCRATCHED",
          voidedAt: new Date(),
          result: LegResult.VOID,
          settledAt: new Date(),
        },
      });

      if (refundAmount > 0) {
        await tx.transaction.create({
          data: {
            userId: leg.userId,
            type: TransactionType.VOID_REFUND,
            amount: refundAmount,
            contestId,
            ticketId: leg.ticketId,
            ticketLegId: leg.id,
            note,
          },
        });
      }
    }
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function publishContestAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  if (!contestId) throw new Error("Missing contestId");

  await prisma.contest.update({
    where: { id: contestId },
    data: { status: ContestStatus.PUBLISHED, publishedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function lockContestAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  if (!contestId) throw new Error("Missing contestId");

  await prisma.contest.update({
    where: { id: contestId },
    data: { status: ContestStatus.LOCKED, lockedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function settleAction(formData: FormData) {
  "use server";
  const auth = await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  if (!contestId) throw new Error("Missing contestId");

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      lanes: { orderBy: { name: "asc" } },
      series: { select: { id: true } },
      settlementSummary: { select: { id: true } },
    },
  });

  if (!contest) throw new Error("Contest not found.");

  const laneCount = contest.lanes.length;

  if (contest.status === ContestStatus.SETTLED) {
    throw new Error("Contest is already settled. Use Reopen (Edit) to modify.");
  }

  if (contest.status !== ContestStatus.LOCKED) {
    throw new Error(`Contest must be LOCKED to settle (current: ${contest.status}).`);
  }

  const existingPayouts = await prisma.transaction.count({
    where: { contestId, type: TransactionType.PAYOUT },
  });

  if (existingPayouts > 0 || contest.settlementSummary) {
    throw new Error(
      "This contest already appears settled (payouts/summary exist). Use Reopen (Edit) to change it."
    );
  }

  const lanes = contest.lanes.map((lane) => {
    const rankRaw = String(formData.get(`rank_${lane.id}`) ?? "").trim();
    const pointsRaw = String(formData.get(`points_${lane.id}`) ?? "").trim();

    const finalRank: number | null = rankRaw === "" ? null : Number(rankRaw);

    if (finalRank !== null && (!Number.isInteger(finalRank) || Number.isNaN(finalRank))) {
      throw new Error("Ranks must be whole numbers.");
    }

    if (finalRank === null) {
      throw new Error("All lanes must be ranked.");
    }

    if (finalRank < 1 || finalRank > laneCount) {
      throw new Error(`Ranks must be between 1 and ${laneCount}.`);
    }

    const fantasyPoints = pointsRaw === "" ? null : Number(pointsRaw);
    if (fantasyPoints !== null && Number.isNaN(fantasyPoints)) {
      throw new Error("Fantasy points must be a number (or left blank).");
    }

    return {
      id: lane.id,
      laneId: lane.id,
      finalRank,
      fantasyPoints,
    };
  });

  if (!lanes.some((l) => l.finalRank === 1)) {
    throw new Error("At least one lane must be ranked 1st.");
  }

  await settleContestAtomic({
    contestId,
    adminId: auth.user.id,
    lanes: lanes as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
  revalidatePath(`/series/${contest.seriesId}/leaderboard`);
}

async function grantCoinsAction(formData: FormData) {
  "use server";
  const auth = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("Grant requires user and positive whole-dollar amount.");
  }

  await prisma.transaction.create({
    data: {
      userId,
      type: TransactionType.GRANT,
      amount,
      note,
      createdByAdminId: auth.user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/me");
  revalidatePath("/");
}

async function createShoutoutAction(formData: FormData) {
  "use server";
  const auth = await requireAdmin();

  const seriesId = String(formData.get("seriesId") ?? "");
  const contestIdRaw = String(formData.get("contestId") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (!seriesId || !message) throw new Error("Series and message are required.");

  await prisma.shoutout.create({
    data: {
      seriesId,
      contestId: contestIdRaw || null,
      message,
      createdByAdminId: auth.user.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

async function reopenSettlementAction(formData: FormData) {
  "use server";
  const auth = await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  if (!contestId) throw new Error("Missing contestId");

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      settlementSummary: { select: { id: true, contestId: true } },
      series: { select: { id: true } },
    },
  });

  if (!contest) throw new Error("Contest not found.");
  if (contest.status !== ContestStatus.SETTLED || !contest.settlementSummary) {
    throw new Error("Contest is not settled.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({
      where: { contestId, type: TransactionType.PAYOUT },
    });

    await tx.settlementSummary.delete({
      where: { contestId },
    });

    await tx.lane.updateMany({
      where: { contestId },
      data: { finalRank: null, fantasyPoints: null },
    });

    await tx.ticketLeg.updateMany({
      where: { contestId },
      data: {
        result: LegResult.PENDING,
        settledAt: null,
      },
    });

    await tx.ticket.updateMany({
      where: { contestId },
      data: {
        status: TicketStatus.SUBMITTED,
        result: TicketResult.PENDING,
        payoutAmount: null,
        netAmount: null,
        settledAt: null,
      },
    });

    await tx.contest.update({
      where: { id: contestId },
      data: { status: ContestStatus.LOCKED, settledAt: null },
    });

    const prefix = "Settlement reopened.";
    const alreadyPosted = await tx.contestPost.findFirst({
      where: {
        contestId,
        isCommish: true,
        body: { startsWith: prefix },
      },
      select: { id: true },
    });

    if (!alreadyPosted) {
      await tx.contestPost.create({
        data: {
          contestId,
          userId: auth.user.id,
          isCommish: true,
          body: `${prefix} Previous results are no longer official. Resettlement pending.`,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
  revalidatePath(`/series/${contest.seriesId}/leaderboard`);
}

// --------------------
// Page
// --------------------
export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user?.id || !session.user.isAdmin) redirect("/auth/login");

  await autoLockContests();

  const [seriesList, users, contests, shoutouts] = await Promise.all([
    prisma.series.findMany({
      orderBy: { createdAt: "desc" },
      include: { contests: { orderBy: { startTime: "asc" } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, email: true },
    }),
    prisma.contest.findMany({
      orderBy: { startTime: "asc" },
      include: {
        series: { select: { id: true, name: true } },
        lanes: { orderBy: { name: "asc" } },
        settlementSummary: {
          select: {
            id: true,
            winPoolGross: true,
            placePoolGross: true,
            showPoolGross: true,
            winTakeoutTotal: true,
            placeTakeoutTotal: true,
            showTakeoutTotal: true,
            winPoolTotal: true,
            placePoolTotal: true,
            showPoolTotal: true,
            winPayoutMultiple: true,
            placePayoutMultiple: true,
            showPayoutMultiple: true,
          },
        },
        tickets: {
          select: {
            id: true,
            payoutAmount: true,
            stakeAmount: true,
            netAmount: true,
            status: true,
            result: true,
          },
        },
      },
    }),
    prisma.shoutout.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        series: { select: { name: true } },
        contest: { select: { title: true } },
      },
    }),
  ]);

  const totalAdminRake = contests.reduce((sum, contest) => {
    const s = contest.settlementSummary;
    if (!s) return sum;

    return (
      sum +
      (s.winTakeoutTotal ?? 0) +
      (s.placeTakeoutTotal ?? 0) +
      (s.showTakeoutTotal ?? 0)
    );
  }, 0);

  const totalAdminRakeWin = contests.reduce(
    (sum, contest) => sum + (contest.settlementSummary?.winTakeoutTotal ?? 0),
    0
  );

  const totalAdminRakePlace = contests.reduce(
    (sum, contest) => sum + (contest.settlementSummary?.placeTakeoutTotal ?? 0),
    0
  );

  const totalAdminRakeShow = contests.reduce(
    (sum, contest) => sum + (contest.settlementSummary?.showTakeoutTotal ?? 0),
    0
  );

  const settledContestCount = contests.filter((contest) => contest.settlementSummary).length;
  const activeContests = contests.filter((c) => !c.archivedAt);
  const archivedContests = contests.filter((c) => c.archivedAt);
  const settled = contests.filter((c) => c.status === ContestStatus.SETTLED && !c.archivedAt);

  const lockedAwaitingSettlement = contests.filter(
    (c) => c.status === ContestStatus.LOCKED && !c.archivedAt
  );

  return (
    <div className="space-y-6">
      <CardSection title="House Rake Summary">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded border border-track-200 bg-track-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-track-500">Total Rake</p>
            <p className="mt-1 text-2xl font-semibold text-track-900">{formatCoins(totalAdminRake)}</p>
            <p className="mt-1 text-xs text-track-500">
              Across {settledContestCount} settled contest{settledContestCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded border border-track-200 bg-track-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-track-500">WIN Rake</p>
            <p className="mt-1 text-xl font-semibold text-track-900">
              {formatCoins(totalAdminRakeWin)}
            </p>
          </div>

          <div className="rounded border border-track-200 bg-track-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-track-500">PLACE Rake</p>
            <p className="mt-1 text-xl font-semibold text-track-900">
              {formatCoins(totalAdminRakePlace)}
            </p>
          </div>

          <div className="rounded border border-track-200 bg-track-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-track-500">SHOW Rake</p>
            <p className="mt-1 text-xl font-semibold text-track-900">
              {formatCoins(totalAdminRakeShow)}
            </p>
          </div>
        </div>
      </CardSection>

      <CardSection title="Admin">
        <p className="text-sm text-neutral-300">
          Create series/contests, manage lanes, settle markets, grant bankroll, and post commish
          notes.
        </p>
      </CardSection>

      <CardSection title="Series">
        <form action={createSeriesAction} className="grid gap-3 md:grid-cols-2">
          <input name="name" placeholder="Series name" required />
          <input name="startDate" type="date" required />
          <input name="endDate" type="date" required />
          <input name="prizesText" placeholder="Prizes text (optional)" />
          <label className="flex items-center gap-2 text-sm">
            <input name="isActive" type="checkbox" />
            Active
          </label>
          <div>
            <button type="submit" className="rounded bg-track-800 px-3 py-1 text-white">
              Create series
            </button>
          </div>
        </form>

        {seriesList.length > 0 ? (
          <div className="mt-4 space-y-2 text-sm">
            {seriesList.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-track-200 p-2"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-track-500">
                    {formatDateTime(s.startDate)} → {formatDateTime(s.endDate)} ·{" "}
                    {s.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <form action={toggleSeriesActiveAction} className="flex items-center gap-2">
                  <input type="hidden" name="seriesId" value={s.id} />
                  <input type="hidden" name="active" value={(!s.isActive).toString()} />
                  <button type="submit" className="rounded bg-track-100 px-3 py-1 text-track-700">
                    {s.isActive ? "Set inactive" : "Set active"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">No series yet.</p>
        )}
      </CardSection>

      <CardSection title="Contests">
        <p className="mb-2 text-sm text-track-600">
          <Link href="/admin/contest-from-game" className="text-amber-600 hover:text-amber-700">
            Create contest from imported game
          </Link>
          {" · "}
          <Link href="/admin/contest-lanes" className="text-amber-600 hover:text-amber-700">
            Contest lane builder
          </Link>
        </p>
        <form action={createContestAction} className="mt-1 grid gap-3 md:grid-cols-2">
          <select name="seriesId" required>
            <option value="">Select series</option>
            {seriesList.map((series) => (
              <option key={series.id} value={series.id}>
                {series.name}
              </option>
            ))}
          </select>

          <input name="title" placeholder="Contest title" required />

          <select name="sport" defaultValue="FOOTBALL" required>
            {SPORTS.map((sport) => (
              <option key={sport} value={sport}>
                {formatSportLabel(sport)}
              </option>
            ))}
          </select>

          <input name="startTime" type="datetime-local" required />

          <select name="status" defaultValue={ContestStatus.DRAFT}>
            {Object.values(ContestStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-track-800 px-3 py-1 text-white">
              Create contest
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {activeContests.map((contest) => (
            <div key={contest.id} className="rounded border border-track-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{contest.title}</p>
                  <p className="text-sm text-track-600">
                    {contest.series?.name ?? "—"} · {contest.sport} ·{" "}
                    {formatDateTime(contest.startTime)} · {contest.status}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/contest/${contest.id}`}
                    className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                  >
                    View
                  </Link>

                  <form action={publishContestAction}>
                    <input type="hidden" name="contestId" value={contest.id} />
                    <button
                      type="submit"
                      className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                      disabled={contest.status !== ContestStatus.DRAFT}
                    >
                      Publish
                    </button>
                  </form>

                  <form action={lockContestAction}>
                    <input type="hidden" name="contestId" value={contest.id} />
                    <button
                      type="submit"
                      className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                      disabled={contest.status !== ContestStatus.PUBLISHED}
                    >
                      Lock
                    </button>
                  </form>

                  <form action={toggleArchiveContestAction}>
                    <input type="hidden" name="contestId" value={contest.id} />
                    <input type="hidden" name="archived" value="true" />
                    <button
                      type="submit"
                      className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                    >
                      Archive
                    </button>
                  </form>
                </div>
              </div>

              <form action={addLaneAction} className="mt-3 grid gap-2 md:grid-cols-5">
                <input type="hidden" name="contestId" value={contest.id} />
                <input name="name" placeholder="Lane name" required />
                <input name="team" placeholder="Team" required />
                <input name="position" placeholder="Position" required />
                <input
                  name="openingWinOddsTo1"
                  type="number"
                  min={0.1}
                  max={999}
                  step="0.1"
                  placeholder="Opening WIN odds to-1 (>0–999)"
                />
                <button type="submit" className="rounded bg-track-800 px-3 py-1 text-white">
                  Add lane
                </button>
              </form>

              <p className="mt-1 text-xs text-track-600">
                Opening odds can be any positive number up to 999, e.g. 2-1, 75-1, 120-1, 150-1.
              </p>

              {contest.lanes.length > 0 ? (
                <div className="mt-3 text-sm text-track-700">
                  <p className="mb-1 font-medium">Lanes</p>
                  <ul className="grid gap-2">
                    {contest.lanes.map((lane) => (
                      <li key={lane.id} className="rounded border border-track-200 p-2">
                        <form action={updateLaneAction} className="grid gap-2 md:grid-cols-6">
                          <input type="hidden" name="laneId" value={lane.id} />
                          <input type="hidden" name="contestId" value={contest.id} />
                          <input name="name" defaultValue={lane.name} required />
                          <input name="team" defaultValue={lane.team} required />
                          <input name="position" defaultValue={lane.position} required />
                          <input
                            name="openingWinOddsTo1"
                            type="number"
                            min={0.1}
                            max={999}
                            step="0.1"
                            defaultValue={lane.openingWinOddsTo1 ?? ""}
                            placeholder="Opening WIN odds to-1 (>0–999)"
                          />
                          <input
                            name="liveFantasyPoints"
                            type="number"
                            step="0.1"
                            defaultValue={(lane as any).liveFantasyPoints ?? ""}
                            placeholder="Live points"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              className="rounded bg-track-100 px-3 py-1 text-track-700"
                            >
                              Save lane
                            </button>
                            <span className="text-xs text-track-500">
                              {lane.finalRank ? `Rank ${lane.finalRank}` : "Unranked"}
                            </span>
                          </div>
                        </form>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <form action={setLaneStatusAction}>
                            <input type="hidden" name="contestId" value={contest.id} />
                            <input type="hidden" name="laneId" value={lane.id} />
                            <input type="hidden" name="status" value="ACTIVE" />
                            <button
                              type="submit"
                              className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                            >
                              Active
                            </button>
                          </form>

                          <form action={setLaneStatusAction}>
                            <input type="hidden" name="contestId" value={contest.id} />
                            <input type="hidden" name="laneId" value={lane.id} />
                            <input type="hidden" name="status" value="QUESTIONABLE" />
                            <button
                              type="submit"
                              className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                            >
                              Questionable
                            </button>
                          </form>

                          <form action={setLaneStatusAction}>
                            <input type="hidden" name="contestId" value={contest.id} />
                            <input type="hidden" name="laneId" value={lane.id} />
                            <input type="hidden" name="status" value="DOUBTFUL" />
                            <button
                              type="submit"
                              className="rounded bg-track-100 px-3 py-1 text-xs text-track-700"
                            >
                              Doubtful
                            </button>
                          </form>

                          <form action={scratchLaneAction}>
                            <input type="hidden" name="contestId" value={contest.id} />
                            <input type="hidden" name="laneId" value={lane.id} />
                            <input type="hidden" name="note" value="SCRATCHED: admin" />
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-3 py-1 text-xs text-white"
                              title="Mark scratched, void legs, refund bets"
                            >
                              Scratch (refund)
                            </button>
                          </form>

                          <span className="text-xs text-track-500">
                            Status: <span className="font-semibold">{lane.status ?? "ACTIVE"}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardSection>

      <ArchivedContestsSection
        archivedContests={archivedContests}
        toggleArchiveContestAction={toggleArchiveContestAction}
      />

      <SettledContestsSection
        settled={settled}
        reopenSettlementAction={reopenSettlementAction}
        toggleArchiveContestAction={toggleArchiveContestAction}
      />

      <CardSection title="Settlement">
        <p className="text-sm text-track-600">
          Enter rank (1..N) for every lane and optional fantasy points. Contest must be locked.
        </p>

        <div className="mt-4 space-y-4">
          {lockedAwaitingSettlement.map((contest) => (
            <form
              key={contest.id}
              action={settleAction}
              className="rounded border border-track-200 p-3"
            >
              <input type="hidden" name="contestId" value={contest.id} />

              <p className="font-medium">{contest.title}</p>
              <p className="text-sm text-track-600">
                {contest.series?.name ?? "—"} · {contest.sport} · {formatDateTime(contest.startTime)}
              </p>

              <div className="mt-3 space-y-2">
                {contest.lanes.map((lane) => (
                  <div key={lane.id} className="grid gap-2 md:grid-cols-4">
                    <div className="md:col-span-2">{lane.name}</div>

                    <input
                      name={`rank_${lane.id}`}
                      type="number"
                      min={1}
                      max={contest.lanes.length}
                      placeholder="Final rank"
                      required
                    />

                    <input
                      name={`points_${lane.id}`}
                      type="number"
                      step="0.01"
                      placeholder="Final fantasy points (optional)"
                    />
                  </div>
                ))}
              </div>

              <button type="submit" className="mt-3 rounded bg-track-800 px-3 py-1 text-white">
                Settle Contest
              </button>
            </form>
          ))}

          {lockedAwaitingSettlement.length === 0 ? (
            <p className="text-sm text-track-600">No locked contests awaiting settlement.</p>
          ) : null}
        </div>
      </CardSection>

      <AdminToolsGrid
        users={users}
        seriesList={seriesList}
        activeContests={activeContests}
        shoutouts={shoutouts}
        grantCoinsAction={grantCoinsAction}
        createShoutoutAction={createShoutoutAction}
      />
    </div>
  );
}