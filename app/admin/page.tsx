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
import { ImportCBBButton } from "@/components/admin/import-cbb-button";
import { PullLiveStatsButton } from "@/components/admin/pull-live-stats-button";
import { computeHockeyFantasyPoints } from "@/lib/scoring-hockey";
import { computeBasketballFantasyPoints } from "@/lib/scoring-basketball";
import {
  computeFootballQBFantasyPointsFromRaw,
  computeFootballSkillFantasyPointsFromRaw,
  computeFootballKickerFantasyPointsFromRaw,
  computeFootballDSTFantasyPointsFromRaw,
  computeBaseballHitterFantasyPointsFromRaw,
  computeBaseballPitcherFantasyPointsFromRaw,
  computeSoccerOutfieldFantasyPointsFromRaw,
  computeSoccerGoalkeeperFantasyPointsFromRaw,
  FOOTBALL_ADMIN_FIELDS,
  BASEBALL_ADMIN_FIELDS,
  SOCCER_ADMIN_FIELDS,
  computeGolfFantasyPointsFromRaw,
  GOLF_ADMIN_FIELDS,
  type AdminFieldDef,
} from "@/lib/scoring-config";

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

function renderAdminFieldsRow({
  lane,
  contestId,
  action,
  fieldDefs,
}: {
  lane: any;
  contestId: string;
  action: (formData: FormData) => Promise<void>;
  fieldDefs: AdminFieldDef[];
}) {
  return (
    <div
      key={lane.id}
      className="flex flex-wrap items-center gap-2 text-xs text-neutral-100"
    >
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="laneId" value={lane.id} />
        <input type="hidden" name="contestId" value={contestId} />
        <div className="min-w-[10rem] font-medium text-neutral-100">
          {lane.name}
          {lane.team ? ` · ${lane.team}` : ""}
          {lane.position ? ` · ${lane.position}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fieldDefs.map((field) => (
            <div key={field.laneKey} className="flex items-center gap-1">
              <span className="text-neutral-300">{field.label}</span>
              <input
                name={field.laneKey}
                type="number"
                step={field.step}
                min={0}
                defaultValue={lane[field.laneKey] ?? ""}
                className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
              />
              {field.quick &&
                field.quick.map((q) => (
                  <button
                    key={q}
                    type="submit"
                    name="stat"
                    value={`${field.rawKey}:${q}`}
                    className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                  >
                    +{q}
                  </button>
                ))}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="text-neutral-300">FP</span>
            <span className="text-neutral-100">
              {lane.liveFantasyPoints != null
                ? Number(lane.liveFantasyPoints).toFixed(2)
                : "0.00"}
            </span>
          </div>
        </div>
        <button
          type="submit"
          className="ml-auto rounded bg-track-800 px-2 py-0.5 text-xs font-semibold text-white"
        >
          Update
        </button>
      </form>
      <form action={setLaneStatusAction} className="flex items-center gap-1">
        <input type="hidden" name="contestId" value={contestId} />
        <input type="hidden" name="laneId" value={lane.id} />
        <span className="text-neutral-200">Status</span>
        <select
          name="status"
          defaultValue={lane.status ?? "ACTIVE"}
          className="rounded border border-track-200 bg-white px-1 py-0.5 text-[10px] text-track-700"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="QUESTIONABLE">QUESTIONABLE</option>
          <option value="DOUBTFUL">DOUBTFUL</option>
          <option value="SCRATCHED">SCRATCHED</option>
        </select>
        <button
          type="submit"
          className="ml-1 rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
        >
          Set
        </button>
      </form>
    </div>
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
   const trackConditionsRaw = String(formData.get("trackConditions") ?? "").trim();

  if (!seriesId || !title || !rawSport || !startTime) {
    throw new Error("Contest series/title/sport/start time are required.");
  }

  if (!SPORTS.includes(rawSport as SportKey)) {
    throw new Error("Invalid sport selected.");
  }

  const sport = rawSport as SportKey;

  const trackConditions =
    trackConditionsRaw ||
    getDefaultTrackConditionsForSport(sport);

  await prisma.contest.create({
    data: {
      seriesId,
      title,
      sport,
      startTime: new Date(startTime),
      status,
      publishedAt: status === ContestStatus.PUBLISHED ? new Date() : null,
      lockedAt: status === ContestStatus.LOCKED ? new Date() : null,
      // cast to any so this stays type-safe once Prisma client is regenerated with trackConditions
      ...( { trackConditions } as any ),
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

  if (!contestId || !name) {
    throw new Error("Lane contest and name are required.");
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

  if (!laneId || !contestId || !name) {
    throw new Error("Lane id, contest, and name are required.");
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

function getDefaultTrackConditionsForSport(s: SportKey): string {
  switch (s) {
    case "HOCKEY":
      return "COLD_ICY";
    case "BASKETBALL":
      return "HARDWOOD_FAST";
    case "FOOTBALL":
      return "GAME_DAY";
    case "BASEBALL":
      return "GAME_DAY";
    default:
      return "NEUTRAL";
  }
}

async function updateLaneLivePointsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const liveFantasyPointsRaw = String(formData.get("liveFantasyPoints") ?? "").trim();
  const deltaRaw = String(formData.get("delta") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  // If a delta is provided, apply it relative to the current liveFantasyPoints value.
  if (deltaRaw !== "") {
    const delta = Number(deltaRaw);
    if (!Number.isFinite(delta)) {
      throw new Error("Live fantasy points delta must be a valid number.");
    }

    const lane = (await prisma.lane.findUnique({
      where: { id: laneId },
    })) as any;

    const current = lane?.liveFantasyPoints ?? 0;
    const liveFantasyPoints = current + delta;

    await prisma.lane.update({
      where: { id: laneId },
      data: { liveFantasyPoints } as any,
    });
  } else {
    let liveFantasyPoints: number | null = null;
    if (liveFantasyPointsRaw !== "") {
      const parsed = Number(liveFantasyPointsRaw);
      if (!Number.isFinite(parsed)) {
        throw new Error("Live fantasy points must be a valid number.");
      }
      liveFantasyPoints = parsed;
    }

    await prisma.lane.update({
      where: { id: laneId },
      // cast to any so this stays type-safe once Prisma client is regenerated with liveFantasyPoints
      data: { liveFantasyPoints } as any,
    });
  }

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateHockeyLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim().toUpperCase();
  const deltaRaw = String(formData.get("delta") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  // Quick stat delta path (e.g. Goal +1, Assist +1).
  // If stat is present but delta is blank, default delta to 1.
  if (statKeyRaw) {
    const delta = Number(deltaRaw || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Hockey stat delta must be a valid number.");
    }

    const lane = (await prisma.lane.findUnique({
      where: { id: laneId },
    })) as any;

    let hockeyGoals = lane?.hockeyGoals ?? 0;
    let hockeyAssists = lane?.hockeyAssists ?? 0;
    let hockeyShotsOnGoal = lane?.hockeyShotsOnGoal ?? 0;
    let hockeySaves = lane?.hockeySaves ?? 0;
    let hockeyBlocks = lane?.hockeyBlocks ?? 0;
    let hockeyShortHandedGoals = lane?.hockeyShortHandedGoals ?? 0;
    let hockeyShortHandedAssists = lane?.hockeyShortHandedAssists ?? 0;
    let hockeyShootoutGoals = lane?.hockeyShootoutGoals ?? 0;
    let hockeyGoalsAgainst = lane?.hockeyGoalsAgainst ?? 0;
    let hockeyShutouts = lane?.hockeyShutouts ?? 0;
    let hockeyOvertimeLosses = lane?.hockeyOvertimeLosses ?? 0;

    switch (statKeyRaw) {
      case "GOAL":
        hockeyGoals = Math.max(0, hockeyGoals + delta);
        break;
      case "ASSIST":
        hockeyAssists = Math.max(0, hockeyAssists + delta);
        break;
      case "SOG":
        hockeyShotsOnGoal = Math.max(0, hockeyShotsOnGoal + delta);
        break;
      case "SAVE":
        hockeySaves = Math.max(0, hockeySaves + delta);
        break;
      case "BLOCK":
        hockeyBlocks = Math.max(0, hockeyBlocks + delta);
        break;
      case "SHG":
        hockeyShortHandedGoals = Math.max(0, hockeyShortHandedGoals + delta);
        break;
      case "SHA":
        hockeyShortHandedAssists = Math.max(0, hockeyShortHandedAssists + delta);
        break;
      case "SO_G":
        hockeyShootoutGoals = Math.max(0, hockeyShootoutGoals + delta);
        break;
      case "GA":
        hockeyGoalsAgainst = Math.max(0, hockeyGoalsAgainst + delta);
        break;
      case "SHUTOUT":
        hockeyShutouts = Math.max(0, hockeyShutouts + delta);
        break;
      case "OTL":
        hockeyOvertimeLosses = Math.max(0, hockeyOvertimeLosses + delta);
        break;
      default:
        // Unknown stat key; fall through to regular path.
        break;
    }

    const liveFantasyPoints = computeHockeyFantasyPoints({
      goals: hockeyGoals,
      assists: hockeyAssists,
      shotsOnGoal: hockeyShotsOnGoal,
      shortHandedGoals: hockeyShortHandedGoals,
      shortHandedAssists: hockeyShortHandedAssists,
      shootoutGoals: hockeyShootoutGoals,
      blockedShots: hockeyBlocks,
      saves: hockeySaves,
      goalsAgainst: hockeyGoalsAgainst,
      shutouts: hockeyShutouts,
      overtimeLosses: hockeyOvertimeLosses,
    });

    await prisma.lane.update({
      where: { id: laneId },
      data: {
        hockeyGoals,
        hockeyAssists,
        hockeyShotsOnGoal,
        hockeySaves,
        hockeyBlocks,
        hockeyShortHandedGoals,
        hockeyShortHandedAssists,
        hockeyShootoutGoals,
        hockeyGoalsAgainst,
        hockeyShutouts,
        hockeyOvertimeLosses,
        liveFantasyPoints,
      } as any,
    });

    revalidatePath("/admin");
    revalidatePath(`/contest/${contestId}`);
    revalidatePath("/");
    return;
  }

  function parseIntField(name: string): number | null {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Hockey stat "${name}" must be a valid number.`);
    }
    return Math.trunc(value);
  }

  const hockeyGoals = parseIntField("hockeyGoals");
  const hockeyAssists = parseIntField("hockeyAssists");
  const hockeyShotsOnGoal = parseIntField("hockeyShotsOnGoal");
  const hockeySaves = parseIntField("hockeySaves");
  const hockeyBlocks = parseIntField("hockeyBlocks");
  const hockeyShortHandedGoals = parseIntField("hockeyShortHandedGoals");
  const hockeyShortHandedAssists = parseIntField("hockeyShortHandedAssists");
  const hockeyShootoutGoals = parseIntField("hockeyShootoutGoals");
  const hockeyGoalsAgainst = parseIntField("hockeyGoalsAgainst");
  const hockeyShutouts = parseIntField("hockeyShutouts");
  const hockeyOvertimeLosses = parseIntField("hockeyOvertimeLosses");

  const liveFantasyPoints = computeHockeyFantasyPoints({
    goals: hockeyGoals ?? 0,
    assists: hockeyAssists ?? 0,
    shotsOnGoal: hockeyShotsOnGoal ?? 0,
    shortHandedGoals: hockeyShortHandedGoals ?? 0,
    shortHandedAssists: hockeyShortHandedAssists ?? 0,
    shootoutGoals: hockeyShootoutGoals ?? 0,
    blockedShots: hockeyBlocks ?? 0,
    saves: hockeySaves ?? 0,
    goalsAgainst: hockeyGoalsAgainst ?? 0,
    shutouts: hockeyShutouts ?? 0,
    overtimeLosses: hockeyOvertimeLosses ?? 0,
  });

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      hockeyGoals,
      hockeyAssists,
      hockeyShotsOnGoal,
      hockeySaves,
      hockeyBlocks,
      hockeyGoalsAgainst,
      hockeyShutouts,
      hockeyOvertimeLosses,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function resetHockeyLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const resetStatusesRaw = String(formData.get("resetStatuses") ?? "").trim().toLowerCase();
  const resetStatuses = resetStatusesRaw === "on" || resetStatusesRaw === "true";

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest || contest.sport !== "HOCKEY") {
    throw new Error("Reset is only available for hockey contests.");
  }

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      liveFantasyPoints: null,
      ...(resetStatuses ? { status: LaneStatus.ACTIVE } : {}),
    } as any,
  });

  // Clear per-lane hockey stat fields separately to satisfy older Prisma client typings.
  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      hockeyGoals: null,
      hockeyAssists: null,
      hockeyShotsOnGoal: null,
      hockeySaves: null,
      hockeyBlocks: null,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function resetBasketballLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const resetStatusesRaw = String(formData.get("resetStatuses") ?? "").trim().toLowerCase();
  const resetStatuses = resetStatusesRaw === "on" || resetStatusesRaw === "true";

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest || contest.sport !== "BASKETBALL") {
    throw new Error("Reset is only available for basketball contests.");
  }

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      liveFantasyPoints: null,
      ...(resetStatuses ? { status: LaneStatus.ACTIVE } : {}),
    } as any,
  });

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      basketballPoints: null,
      basketballThreesMade: null,
      basketballRebounds: null,
      basketballAssists: null,
      basketballSteals: null,
      basketballBlocks: null,
      basketballTurnovers: null,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function resetSoccerLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const resetStatusesRaw = String(formData.get("resetStatuses") ?? "").trim().toLowerCase();
  const resetStatuses = resetStatusesRaw === "on" || resetStatusesRaw === "true";

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest || contest.sport !== "SOCCER") {
    throw new Error("Reset is only available for soccer contests.");
  }

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      liveFantasyPoints: null,
      ...(resetStatuses ? { status: LaneStatus.ACTIVE } : {}),
    } as any,
  });

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      soccerGoals: null,
      soccerAssists: null,
      soccerShotsOnTarget: null,
      soccerChancesCreated: null,
      soccerCrosses: null,
      soccerTacklesWon: null,
      soccerInterceptions: null,
      soccerFoulsCommitted: null,
      soccerYellowCards: null,
      soccerRedCards: null,
      soccerSaves: null,
      soccerGoalsAllowed: null,
      soccerCleanSheet: null,
      soccerPenaltySaves: null,
      soccerWins: null,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function resetGolfLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const resetStatusesRaw = String(formData.get("resetStatuses") ?? "").trim().toLowerCase();
  const resetStatuses = resetStatusesRaw === "on" || resetStatusesRaw === "true";

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest || contest.sport !== "GOLF") {
    throw new Error("Reset is only available for golf contests.");
  }

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      liveFantasyPoints: null,
      ...(resetStatuses ? { status: LaneStatus.ACTIVE } : {}),
    } as any,
  });

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      golfBirdies: null,
      golfEagles: null,
      golfAlbatrosses: null,
      golfPars: null,
      golfBogeys: null,
      golfDoubleBogeyOrWorse: null,
      golfHoleInOnes: null,
      golfBirdieStreaks3Plus: null,
      golfBogeyFreeRounds: null,
      golfRoundsUnder70: null,
      golfMadeCut: null,
      golfTop10Finish: null,
      golfWins: null,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function resetFootballLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const resetStatusesRaw = String(formData.get("resetStatuses") ?? "").trim().toLowerCase();
  const resetStatuses = resetStatusesRaw === "on" || resetStatusesRaw === "true";

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest || contest.sport !== "FOOTBALL") {
    throw new Error("Reset is only available for football contests.");
  }

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      liveFantasyPoints: null,
      ...(resetStatuses ? { status: LaneStatus.ACTIVE } : {}),
    } as any,
  });

  await prisma.lane.updateMany({
    where: { contestId },
    data: {
      footballPassingTDs: null,
      footballRushingTDs: null,
      footballReceivingTDs: null,
      footballPassingYards: null,
      footballRushingYards: null,
      footballReceivingYards: null,
      footballReceptions: null,
      footballInterceptions: null,
      footballTwoPointConversions: null,
      footballFumblesLost: null,
      footballExtraPointsMade: null,
      footballFieldGoals0to39: null,
      footballFieldGoals40to49: null,
      footballFieldGoals50Plus: null,
      footballFieldGoalsMissed: null,
      footballSacks: null,
      footballDSTInterceptions: null,
      footballFumbleRecoveries: null,
      footballDefensiveTDs: null,
      footballSafeties: null,
      footballBlockedKicks: null,
      footballPointsAllowed: null,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateBaseballLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  const lane = (await prisma.lane.findUnique({
    where: { id: laneId },
  })) as any;

  const position = (lane?.position ?? "").toUpperCase();
  const isPitcher = position === "P" || position === "SP" || position === "RP";
  const fieldDefs = isPitcher
    ? BASEBALL_ADMIN_FIELDS.PITCHER
    : BASEBALL_ADMIN_FIELDS.HITTER;

  const updated: Record<string, any> = {};

  if (statKeyRaw) {
    const [rawKey, rawDelta] = statKeyRaw.split(":");
    const delta = Number(rawDelta || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Baseball stat delta must be a valid number.");
    }

    const def = fieldDefs.find((f) => f.rawKey === rawKey);
    if (def) {
      const current = (lane as any)[def.laneKey] ?? 0;
      updated[def.laneKey] = def.inputType === "int"
        ? Math.max(0, current + delta)
        : current + delta;
    }
  } else {
    for (const def of fieldDefs) {
      const raw = String(formData.get(def.laneKey) ?? "").trim();
      if (raw === "") {
        updated[def.laneKey] = null;
      } else {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(`Baseball stat "${def.label}" must be a valid number.`);
        }
        updated[def.laneKey] = def.inputType === "int" ? Math.trunc(value) : value;
      }
    }
  }

  const mergedLane = { ...lane, ...updated };

  const liveFantasyPoints = isPitcher
    ? computeBaseballPitcherFantasyPointsFromRaw({
        inningsPitched: mergedLane.baseballInningsPitched ?? 0,
        strikeouts: mergedLane.baseballStrikeoutsPitching ?? 0,
        wins: mergedLane.baseballWins ?? 0,
        earnedRuns: mergedLane.baseballEarnedRuns ?? 0,
        hitsAllowed: mergedLane.baseballHitsAllowed ?? 0,
        walksAllowed: mergedLane.baseballWalksAllowed ?? 0,
        saves: mergedLane.baseballSaves ?? 0,
        qualityStart: mergedLane.baseballQualityStart ?? 0,
      })
    : computeBaseballHitterFantasyPointsFromRaw({
        singles: mergedLane.baseballSingles ?? 0,
        doubles: mergedLane.baseballDoubles ?? 0,
        triples: mergedLane.baseballTriples ?? 0,
        homeRuns: mergedLane.baseballHomeRuns ?? 0,
        runs: mergedLane.baseballRuns ?? 0,
        runsBattedIn: mergedLane.baseballRunsBattedIn ?? 0,
        walks: mergedLane.baseballWalks ?? 0,
        stolenBases: mergedLane.baseballStolenBases ?? 0,
        strikeouts: mergedLane.baseballStrikeouts ?? 0,
      });

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      ...updated,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateGolfLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  const lane = (await prisma.lane.findUnique({
    where: { id: laneId },
  })) as any;

  const fieldDefs = GOLF_ADMIN_FIELDS.GOLFER;
  const updated: Record<string, any> = {};

  if (statKeyRaw) {
    const [rawKey, rawDelta] = statKeyRaw.split(":");
    const delta = Number(rawDelta || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Golf stat delta must be a valid number.");
    }
    const def = fieldDefs.find((f) => f.rawKey === rawKey);
    if (def) {
      const current = (lane as any)[def.laneKey] ?? 0;
      updated[def.laneKey] = Math.max(0, current + delta);
    }
  } else {
    for (const def of fieldDefs) {
      const raw = String(formData.get(def.laneKey) ?? "").trim();
      if (raw === "") {
        updated[def.laneKey] = null;
      } else {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(`Golf stat "${def.label}" must be a valid number.`);
        }
        updated[def.laneKey] = Math.trunc(value);
      }
    }
  }

  const mergedLane = { ...lane, ...updated };

  const liveFantasyPoints = computeGolfFantasyPointsFromRaw({
    birdies: mergedLane.golfBirdies ?? 0,
    eagles: mergedLane.golfEagles ?? 0,
    albatrosses: mergedLane.golfAlbatrosses ?? 0,
    pars: mergedLane.golfPars ?? 0,
    bogeys: mergedLane.golfBogeys ?? 0,
    doubleBogeyOrWorse: mergedLane.golfDoubleBogeyOrWorse ?? 0,
    holeInOnes: mergedLane.golfHoleInOnes ?? 0,
    birdieStreaks3Plus: mergedLane.golfBirdieStreaks3Plus ?? 0,
    bogeyFreeRounds: mergedLane.golfBogeyFreeRounds ?? 0,
    roundsUnder70: mergedLane.golfRoundsUnder70 ?? 0,
    madeCut: mergedLane.golfMadeCut ?? 0,
    top10Finish: mergedLane.golfTop10Finish ?? 0,
    wins: mergedLane.golfWins ?? 0,
  });

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      ...updated,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateFootballLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  const lane = (await prisma.lane.findUnique({
    where: { id: laneId },
  })) as any;

  const position = (lane?.position ?? "").toUpperCase();
  const role =
    position === "QB"
      ? "QB"
      : position === "K"
      ? "K"
      : position === "DST" || position === "DEF"
      ? "DST"
      : "SKILL";

  const fieldDefs =
    role === "QB"
      ? FOOTBALL_ADMIN_FIELDS.QB
      : role === "K"
      ? FOOTBALL_ADMIN_FIELDS.K
      : role === "DST"
      ? FOOTBALL_ADMIN_FIELDS.DST
      : FOOTBALL_ADMIN_FIELDS.SKILL;

  const updated: Record<string, any> = {};

  // Quick delta path
  if (statKeyRaw) {
    const [rawKey, rawDelta] = statKeyRaw.split(":");
    const delta = Number(rawDelta || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Football stat delta must be a valid number.");
    }

    const def = fieldDefs.find((f) => f.rawKey === rawKey);
    if (def) {
      const current = (lane as any)[def.laneKey] ?? 0;
      updated[def.laneKey] = Math.max(0, current + delta);
    }
  } else {
    // Full form update: parse each field.
    for (const def of fieldDefs) {
      const raw = String(formData.get(def.laneKey) ?? "").trim();
      if (raw === "") {
        updated[def.laneKey] = null;
      } else {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new Error(`Football stat "${def.label}" must be a valid number.`);
        }
        updated[def.laneKey] = def.inputType === "int" ? Math.trunc(value) : value;
      }
    }
  }

  const mergedLane = { ...lane, ...updated };

  let liveFantasyPoints = 0;
  if (role === "QB") {
    liveFantasyPoints = computeFootballQBFantasyPointsFromRaw({
      passingYards: mergedLane.footballPassingYards ?? 0,
      passingTouchdowns: mergedLane.footballPassingTDs ?? 0,
      interceptionsThrown: mergedLane.footballInterceptions ?? 0,
      rushingYards: mergedLane.footballRushingYards ?? 0,
      rushingTouchdowns: mergedLane.footballRushingTDs ?? 0,
      twoPointConversions: mergedLane.footballTwoPointConversions ?? 0,
      fumblesLost: mergedLane.footballFumblesLost ?? 0,
    });
  } else if (role === "K") {
    liveFantasyPoints = computeFootballKickerFantasyPointsFromRaw({
      extraPointsMade: mergedLane.footballExtraPointsMade ?? 0,
      fieldGoals0to39: mergedLane.footballFieldGoals0to39 ?? 0,
      fieldGoals40to49: mergedLane.footballFieldGoals40to49 ?? 0,
      fieldGoals50Plus: mergedLane.footballFieldGoals50Plus ?? 0,
      fieldGoalsMissed: mergedLane.footballFieldGoalsMissed ?? 0,
    });
  } else if (role === "DST") {
    liveFantasyPoints = computeFootballDSTFantasyPointsFromRaw({
      sacks: mergedLane.footballSacks ?? 0,
      interceptions: mergedLane.footballDSTInterceptions ?? 0,
      fumbleRecoveries: mergedLane.footballFumbleRecoveries ?? 0,
      defensiveTouchdowns: mergedLane.footballDefensiveTDs ?? 0,
      safeties: mergedLane.footballSafeties ?? 0,
      blockedKicks: mergedLane.footballBlockedKicks ?? 0,
      pointsAllowed: mergedLane.footballPointsAllowed ?? 0,
    });
  } else {
    liveFantasyPoints = computeFootballSkillFantasyPointsFromRaw({
      rushingYards: mergedLane.footballRushingYards ?? 0,
      rushingTouchdowns: mergedLane.footballRushingTDs ?? 0,
      receptions: mergedLane.footballReceptions ?? 0,
      receivingYards: mergedLane.footballReceivingYards ?? 0,
      receivingTouchdowns: mergedLane.footballReceivingTDs ?? 0,
      twoPointConversions: mergedLane.footballTwoPointConversions ?? 0,
      fumblesLost: mergedLane.footballFumblesLost ?? 0,
    });
  }

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      ...updated,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateBasketballLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim().toUpperCase();
  const deltaRaw = String(formData.get("delta") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  // Quick stat delta path (e.g. Point +1, Rebound +1).
  if (statKeyRaw) {
    const delta = Number(deltaRaw || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Basketball stat delta must be a valid number.");
    }

    const lane = (await prisma.lane.findUnique({
      where: { id: laneId },
    })) as any;

    let basketballPoints = lane?.basketballPoints ?? 0;
    let basketballThreesMade = lane?.basketballThreesMade ?? 0;
    let basketballRebounds = lane?.basketballRebounds ?? 0;
    let basketballAssists = lane?.basketballAssists ?? 0;
    let basketballSteals = lane?.basketballSteals ?? 0;
    let basketballBlocks = lane?.basketballBlocks ?? 0;
    let basketballTurnovers = lane?.basketballTurnovers ?? 0;

    switch (statKeyRaw) {
      case "POINT":
        basketballPoints = Math.max(0, basketballPoints + delta);
        break;
      case "THREE":
        basketballThreesMade = Math.max(0, basketballThreesMade + delta);
        break;
      case "REB":
        basketballRebounds = Math.max(0, basketballRebounds + delta);
        break;
      case "AST":
        basketballAssists = Math.max(0, basketballAssists + delta);
        break;
      case "STL":
        basketballSteals = Math.max(0, basketballSteals + delta);
        break;
      case "BLK":
        basketballBlocks = Math.max(0, basketballBlocks + delta);
        break;
      case "TOV":
        basketballTurnovers = Math.max(0, basketballTurnovers + delta);
        break;
      default:
        break;
    }

    const liveFantasyPoints = computeBasketballFantasyPoints({
      points: basketballPoints,
      threePointersMade: basketballThreesMade,
      rebounds: basketballRebounds,
      assists: basketballAssists,
      steals: basketballSteals,
      blocks: basketballBlocks,
      turnovers: basketballTurnovers,
    });

    await prisma.lane.update({
      where: { id: laneId },
      data: {
        basketballPoints,
        basketballThreesMade,
        basketballRebounds,
        basketballAssists,
        basketballSteals,
        basketballBlocks,
        basketballTurnovers,
        liveFantasyPoints,
      } as any,
    });

    revalidatePath("/admin");
    revalidatePath(`/contest/${contestId}`);
    revalidatePath("/");
    return;
  }

  function parseIntField(name: string): number | null {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Basketball stat "${name}" must be a valid number.`);
    }
    return Math.trunc(value);
  }

  const basketballPoints = parseIntField("basketballPoints");
  const basketballThreesMade = parseIntField("basketballThreesMade");
  const basketballRebounds = parseIntField("basketballRebounds");
  const basketballAssists = parseIntField("basketballAssists");
  const basketballSteals = parseIntField("basketballSteals");
  const basketballBlocks = parseIntField("basketballBlocks");
  const basketballTurnovers = parseIntField("basketballTurnovers");

  const liveFantasyPoints = computeBasketballFantasyPoints({
    points: basketballPoints ?? 0,
    threePointersMade: basketballThreesMade ?? 0,
    rebounds: basketballRebounds ?? 0,
    assists: basketballAssists ?? 0,
    steals: basketballSteals ?? 0,
    blocks: basketballBlocks ?? 0,
    turnovers: basketballTurnovers ?? 0,
  });

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      basketballPoints,
      basketballThreesMade,
      basketballRebounds,
      basketballAssists,
      basketballSteals,
      basketballBlocks,
      basketballTurnovers,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateSoccerLiveStatsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const laneId = String(formData.get("laneId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const statKeyRaw = String(formData.get("stat") ?? "").trim();
  const deltaRaw = String(formData.get("delta") ?? "").trim();

  if (!laneId || !contestId) {
    throw new Error("Missing laneId/contestId");
  }

  // Helper to determine if lane is goalkeeper.
  const lane = (await prisma.lane.findUnique({
    where: { id: laneId },
  })) as any;

  const isGoalkeeper = (lane?.position ?? "").toUpperCase() === "GK";

  // Quick stat delta path (e.g. Goal +1, Assist +1).
  if (statKeyRaw) {
    const [rawKey, rawDelta] = statKeyRaw.split(":");
    const delta = Number(rawDelta || "1");
    if (!Number.isFinite(delta)) {
      throw new Error("Soccer stat delta must be a valid number.");
    }

    if (isGoalkeeper) {
      let soccerSaves = lane?.soccerSaves ?? 0;
      let soccerGoalsAllowed = lane?.soccerGoalsAllowed ?? 0;
      let soccerCleanSheet = lane?.soccerCleanSheet ?? 0;
      let soccerPenaltySaves = lane?.soccerPenaltySaves ?? 0;
      let soccerWins = lane?.soccerWins ?? 0;

      switch (rawKey.toUpperCase()) {
        case "SAVE":
          soccerSaves = Math.max(0, soccerSaves + delta);
          break;
        case "GA":
          soccerGoalsAllowed = Math.max(0, soccerGoalsAllowed + delta);
          break;
        case "CS":
          soccerCleanSheet = Math.max(0, soccerCleanSheet + delta);
          break;
        case "PK_SAVE":
          soccerPenaltySaves = Math.max(0, soccerPenaltySaves + delta);
          break;
        case "WIN":
          soccerWins = Math.max(0, soccerWins + delta);
          break;
        default:
          break;
      }

      const liveFantasyPoints = computeSoccerGoalkeeperFantasyPointsFromRaw({
        saves: soccerSaves,
        goalsAllowed: soccerGoalsAllowed,
        cleanSheet: soccerCleanSheet,
        penaltySaves: soccerPenaltySaves,
        wins: soccerWins,
      });

      await prisma.lane.update({
        where: { id: laneId },
        data: {
          soccerSaves,
          soccerGoalsAllowed,
          soccerCleanSheet,
          soccerPenaltySaves,
          soccerWins,
          liveFantasyPoints,
        } as any,
      });

      revalidatePath("/admin");
      revalidatePath(`/contest/${contestId}`);
      revalidatePath("/");
      return;
    }

    // Outfield quick path
    let soccerGoals = lane?.soccerGoals ?? 0;
    let soccerAssists = lane?.soccerAssists ?? 0;
    let soccerShotsOnTarget = lane?.soccerShotsOnTarget ?? 0;

    switch (rawKey.toUpperCase()) {
      case "GOAL":
        soccerGoals = Math.max(0, soccerGoals + delta);
        break;
      case "ASSIST":
        soccerAssists = Math.max(0, soccerAssists + delta);
        break;
      case "SHOT":
        soccerShotsOnTarget = Math.max(0, soccerShotsOnTarget + delta);
        break;
      default:
        break;
    }

    const liveFantasyPoints = computeSoccerOutfieldFantasyPointsFromRaw({
      goals: soccerGoals,
      assists: soccerAssists,
      shotsOnTarget: soccerShotsOnTarget,
      chancesCreated: lane?.soccerChancesCreated ?? 0,
      crosses: lane?.soccerCrosses ?? 0,
      tacklesWon: lane?.soccerTacklesWon ?? 0,
      interceptions: lane?.soccerInterceptions ?? 0,
      foulsCommitted: lane?.soccerFoulsCommitted ?? 0,
      yellowCards: lane?.soccerYellowCards ?? 0,
      redCards: lane?.soccerRedCards ?? 0,
    });

    await prisma.lane.update({
      where: { id: laneId },
      data: {
        soccerGoals,
        soccerAssists,
        soccerShotsOnTarget,
        liveFantasyPoints,
      } as any,
    });

    revalidatePath("/admin");
    revalidatePath(`/contest/${contestId}`);
    revalidatePath("/");
    return;
  }

  function parseIntField(name: string): number | null {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Soccer stat "${name}" must be a valid number.`);
    }
    return Math.trunc(value);
  }

  const soccerGoals = parseIntField("soccerGoals");
  const soccerAssists = parseIntField("soccerAssists");
  const soccerShotsOnTarget = parseIntField("soccerShotsOnTarget");
  const soccerChancesCreated = parseIntField("soccerChancesCreated");
  const soccerCrosses = parseIntField("soccerCrosses");
  const soccerTacklesWon = parseIntField("soccerTacklesWon");
  const soccerInterceptions = parseIntField("soccerInterceptions");
  const soccerFoulsCommitted = parseIntField("soccerFoulsCommitted");
  const soccerYellowCards = parseIntField("soccerYellowCards");
  const soccerRedCards = parseIntField("soccerRedCards");
  const soccerSaves = parseIntField("soccerSaves");
  const soccerGoalsAllowed = parseIntField("soccerGoalsAllowed");
  const soccerCleanSheet = parseIntField("soccerCleanSheet");
  const soccerPenaltySaves = parseIntField("soccerPenaltySaves");
  const soccerWins = parseIntField("soccerWins");

  const liveFantasyPoints = isGoalkeeper
    ? computeSoccerGoalkeeperFantasyPointsFromRaw({
        saves: soccerSaves ?? 0,
        goalsAllowed: soccerGoalsAllowed ?? 0,
        cleanSheet: soccerCleanSheet ?? 0,
        penaltySaves: soccerPenaltySaves ?? 0,
        wins: soccerWins ?? 0,
      })
    : computeSoccerOutfieldFantasyPointsFromRaw({
        goals: soccerGoals ?? 0,
        assists: soccerAssists ?? 0,
        shotsOnTarget: soccerShotsOnTarget ?? 0,
        chancesCreated: soccerChancesCreated ?? 0,
        crosses: soccerCrosses ?? 0,
        tacklesWon: soccerTacklesWon ?? 0,
        interceptions: soccerInterceptions ?? 0,
        foulsCommitted: soccerFoulsCommitted ?? 0,
        yellowCards: soccerYellowCards ?? 0,
        redCards: soccerRedCards ?? 0,
      });

  await prisma.lane.update({
    where: { id: laneId },
    data: {
      soccerGoals,
      soccerAssists,
      soccerShotsOnTarget,
      soccerChancesCreated,
      soccerCrosses,
      soccerTacklesWon,
      soccerInterceptions,
      soccerFoulsCommitted,
      soccerYellowCards,
      soccerRedCards,
      soccerSaves,
      soccerGoalsAllowed,
      soccerCleanSheet,
      soccerPenaltySaves,
      soccerWins,
      liveFantasyPoints,
    } as any,
  });

  revalidatePath("/admin");
  revalidatePath(`/contest/${contestId}`);
  revalidatePath("/");
}

async function updateContestTrackConditionsAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const contestId = String(formData.get("contestId") ?? "");
  const trackConditionsRaw = String(formData.get("trackConditions") ?? "").trim();

  if (!contestId) {
    throw new Error("Missing contestId");
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { sport: true },
  });

  if (!contest) {
    throw new Error("Contest not found");
  }

  const sport = contest.sport as SportKey;
  const trackConditions =
    trackConditionsRaw || getDefaultTrackConditionsForSport(sport);

  await prisma.contest.update({
    where: { id: contestId },
    // cast to any so this stays type-safe once Prisma client is regenerated with trackConditions
    data: { trackConditions } as any,
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
        lanes: {
          orderBy: { name: "asc" },
          include: {
            player: {
              select: { id: true, externalId: true, externalProvider: true },
            },
          },
        },
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
      <CardSection title="Data providers (NCAA basketball)" right={null}>
        <p className="text-xs text-track-600 mb-2">
          Import CBB league, teams, and players from SportsDataIO so you can create contests from
          game and build lanes. Then use{" "}
          <Link href="/admin/contest-from-game" className="text-amber-600 hover:underline">
            Create contest from game
          </Link>{" "}
          and select the CBB league to load the schedule.
        </p>
        <ImportCBBButton />
      </CardSection>

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

          <select name="trackConditions" defaultValue="">
            <option value="">Auto track conditions (based on sport)</option>
            <option value="COLD_ICY">Cold / Icy</option>
            <option value="HARDWOOD_FAST">Hardwood / Fast</option>
            <option value="GAME_DAY">Game Day</option>
            <option value="FAST">Fast</option>
            <option value="GOOD">Good</option>
            <option value="SLOW">Slow</option>
            <option value="HEAVY">Heavy</option>
            <option value="FROZEN">Frozen</option>
            <option value="SLOPPY">Sloppy</option>
            <option value="WET">Wet</option>
            <option value="NEUTRAL">Neutral</option>
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
            <details key={contest.id} className="rounded border border-track-200 group">
              <summary className="cursor-pointer list-none p-3 hover:bg-track-50/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{contest.title}</p>
                    <p className="text-sm text-track-600">
                      {contest.series?.name ?? "—"} · {contest.sport} ·{" "}
                      {formatDateTime(contest.startTime)} · {contest.status}
                    </p>
                  </div>
                  <span className="text-xs text-track-500 select-none group-open:hidden">Expand ▼</span>
                  <span className="text-xs text-track-500 select-none hidden group-open:inline">Collapse ▲</span>
                </div>
              </summary>
              <div className="border-t border-track-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{contest.title}</p>
                  <p className="text-sm text-track-600">
                    {contest.series?.name ?? "—"} · {contest.sport} ·{" "}
                    {formatDateTime(contest.startTime)} · {contest.status}
                  </p>
                  <form
                    action={updateContestTrackConditionsAction}
                    className="mt-1 flex flex-wrap items-center gap-2 text-xs text-track-600"
                  >
                    <input type="hidden" name="contestId" value={contest.id} />
                    <span>Track conditions:</span>
                    <select
                      name="trackConditions"
                      defaultValue={(contest as any).trackConditions ?? ""}
                      className="rounded border border-track-200 bg-white px-1 py-0.5 text-xs text-track-700"
                    >
                      <option value="">Auto (based on sport)</option>
                      <option value="COLD_ICY">Cold / Icy</option>
                      <option value="HARDWOOD_FAST">Hardwood / Fast</option>
                      <option value="GAME_DAY">Game Day</option>
                      <option value="FAST">Fast</option>
                      <option value="GOOD">Good</option>
                      <option value="SLOW">Slow</option>
                      <option value="HEAVY">Heavy</option>
                      <option value="FROZEN">Frozen</option>
                      <option value="SLOPPY">Sloppy</option>
                      <option value="WET">Wet</option>
                      <option value="NEUTRAL">Neutral</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded bg-track-800 px-2 py-0.5 text-[11px] font-semibold text-white"
                    >
                      Save
                    </button>
                  </form>
                </div>

                {(contest as any).sport === "BASKETBALL" && (
                  <p className="mt-1 text-[11px] text-track-600">
                    External game:{" "}
                    {(contest as any).externalProvider && (contest as any).externalId ? (
                      <span className="font-mono">
                        {(contest as any).externalProvider} / {(contest as any).externalId}
                      </span>
                    ) : (
                      <span className="text-amber-600">— not set</span>
                    )}
                    {" · "}
                    Lanes:{" "}
                    {contest.lanes.filter(
                      (l: any) => l.player?.externalId && l.player?.externalProvider
                    ).length}
                    of {contest.lanes.length} linked
                    {(contest as any).lastLiveStatsPullAt && (
                      <>
                        {" · "}
                        Last pull: {(contest as any).lastLiveStatsUpdatedCount ?? 0} lanes at{" "}
                        {formatDateTime((contest as any).lastLiveStatsPullAt)}
                      </>
                    )}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/contest/${contest.id}`}
                    className="rounded bg-track-100 px-3 py-1 text-sm text-track-700"
                  >
                    View
                  </Link>

                  {(contest as any).sport === "BASKETBALL" &&
                    (contest as any).externalProvider === "sportsdataio" &&
                    (contest as any).externalId && (
                      <PullLiveStatsButton contestId={contest.id} />
                    )}

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
                <input name="team" placeholder="Team (optional)" />
                <input name="position" placeholder="Position (optional)" />
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
                <div className="mt-3 space-y-3 text-sm text-track-700">
                  <div>
                    <p className="mb-1 font-medium">Lanes</p>
                    <ul className="grid gap-2">
                      {contest.lanes.map((lane) => (
                        <li key={lane.id} className="rounded border border-track-200 p-2">
                          <form action={updateLaneAction} className="grid gap-2 md:grid-cols-6">
                            <input type="hidden" name="laneId" value={lane.id} />
                            <input type="hidden" name="contestId" value={contest.id} />
                            <input name="name" defaultValue={lane.name} required />
                            <input name="team" defaultValue={lane.team} placeholder="Team (optional)" />
                            <input
                              name="position"
                              defaultValue={lane.position}
                              placeholder="Position (optional)"
                            />
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

                  {(contest.status === ContestStatus.PUBLISHED ||
                    contest.status === ContestStatus.LOCKED ||
                    contest.status === ContestStatus.DRAFT) && (
                    <div className="rounded border border-track-200 bg-track-50/40 p-2">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-track-700">
                          Live scoring
                        </p>
                        {contest.sport === "HOCKEY" && (
                          <form
                            action={resetHockeyLiveStatsAction}
                            className="flex flex-wrap items-center gap-2 text-[10px]"
                          >
                            <input type="hidden" name="contestId" value={contest.id} />
                            <label className="flex items-center gap-1 text-track-600">
                              <input
                                type="checkbox"
                                name="resetStatuses"
                                className="h-3 w-3 rounded border-track-300 text-track-800"
                              />
                              <span>Reset statuses to ACTIVE</span>
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Reset Hockey Live Stats
                            </button>
                          </form>
                        )}
                        {contest.sport === "BASKETBALL" && (
                          <form
                            action={resetBasketballLiveStatsAction}
                            className="flex flex-wrap items-center gap-2 text-[10px]"
                          >
                            <input type="hidden" name="contestId" value={contest.id} />
                            <label className="flex items-center gap-1 text-track-600">
                              <input
                                type="checkbox"
                                name="resetStatuses"
                                className="h-3 w-3 rounded border-track-300 text-track-800"
                              />
                              <span>Reset statuses to ACTIVE</span>
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Reset Basketball Live Stats
                            </button>
                          </form>
                        )}
                        {contest.sport === "SOCCER" && (
                          <form
                            action={resetSoccerLiveStatsAction}
                            className="flex flex-wrap items-center gap-2 text-[10px]"
                          >
                            <input type="hidden" name="contestId" value={contest.id} />
                            <label className="flex items-center gap-1 text-track-600">
                              <input
                                type="checkbox"
                                name="resetStatuses"
                                className="h-3 w-3 rounded border-track-300 text-track-800"
                              />
                              <span>Reset statuses to ACTIVE</span>
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Reset Soccer Live Stats
                            </button>
                          </form>
                        )}
                        {contest.sport === "FOOTBALL" && (
                          <form
                            action={resetFootballLiveStatsAction}
                            className="flex flex-wrap items-center gap-2 text-[10px]"
                          >
                            <input type="hidden" name="contestId" value={contest.id} />
                            <label className="flex items-center gap-1 text-track-600">
                              <input
                                type="checkbox"
                                name="resetStatuses"
                                className="h-3 w-3 rounded border-track-300 text-track-800"
                              />
                              <span>Reset statuses to ACTIVE</span>
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Reset Football Live Stats
                            </button>
                          </form>
                        )}
                        {contest.sport === "GOLF" && (
                          <form
                            action={resetGolfLiveStatsAction}
                            className="flex flex-wrap items-center gap-2 text-[10px]"
                          >
                            <input type="hidden" name="contestId" value={contest.id} />
                            <label className="flex items-center gap-1 text-track-600">
                              <input
                                type="checkbox"
                                name="resetStatuses"
                                className="h-3 w-3 rounded border-track-300 text-track-800"
                              />
                              <span>Reset statuses to ACTIVE</span>
                            </label>
                            <button
                              type="submit"
                              className="rounded bg-track-800 px-2 py-0.5 text-[10px] font-semibold text-white"
                            >
                              Reset Golf Live Stats
                            </button>
                          </form>
                        )}
                      </div>
                      <div className="space-y-1">
                        {contest.sport === "HOCKEY"
                          ? contest.lanes.map((lane) => (
                              <div
                                key={lane.id}
                                className="flex flex-wrap items-center gap-2 text-xs text-neutral-100"
                              >
                                <form
                                  action={updateHockeyLiveStatsAction}
                                  className="flex flex-1 flex-wrap items-center gap-2"
                                >
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <div className="min-w-[10rem] font-medium text-neutral-100">
                                    {lane.name}
                                    {lane.team ? ` · ${lane.team}` : ""}
                                    {lane.position ? ` · ${lane.position}` : ""}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">G</span>
                                      <input
                                        name="hockeyGoals"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyGoals ?? ""}
                                        className="w-12 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="GOAL"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">A</span>
                                      <input
                                        name="hockeyAssists"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyAssists ?? ""}
                                        className="w-12 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="ASSIST"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">SOG</span>
                                      <input
                                        name="hockeyShotsOnGoal"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyShotsOnGoal ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SOG"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">Saves</span>
                                      <input
                                        name="hockeySaves"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeySaves ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SAVE"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">Blocks</span>
                                      <input
                                        name="hockeyBlocks"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyBlocks ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="BLOCK"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">SHG</span>
                                      <input
                                        name="hockeyShortHandedGoals"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyShortHandedGoals ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SHG"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">SHA</span>
                                      <input
                                        name="hockeyShortHandedAssists"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyShortHandedAssists ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SHA"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">SO G</span>
                                      <input
                                        name="hockeyShootoutGoals"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyShootoutGoals ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SO_G"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">GA</span>
                                      <input
                                        name="hockeyGoalsAgainst"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyGoalsAgainst ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="GA"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">SO</span>
                                      <input
                                        name="hockeyShutouts"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyShutouts ?? ""}
                                        className="w-12 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="SHUTOUT"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">OTL</span>
                                      <input
                                        name="hockeyOvertimeLosses"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).hockeyOvertimeLosses ?? ""}
                                        className="w-12 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="OTL"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">FP</span>
                                      <span className="text-neutral-100">
                                        {(lane as any).liveFantasyPoints != null
                                          ? Number((lane as any).liveFantasyPoints).toFixed(2)
                                          : "0.00"}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="submit"
                                    className="ml-auto rounded bg-track-800 px-2 py-0.5 text-xs font-semibold text-white"
                                  >
                                    Update
                                  </button>
                                </form>
                                <form
                                  action={setLaneStatusAction}
                                  className="flex items-center gap-1"
                                >
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <span className="text-neutral-200">Status</span>
                                  <select
                                    name="status"
                                    defaultValue={lane.status ?? "ACTIVE"}
                                    className="rounded border border-track-200 bg-white px-1 py-0.5 text-[10px] text-track-700"
                                  >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="QUESTIONABLE">QUESTIONABLE</option>
                                    <option value="DOUBTFUL">DOUBTFUL</option>
                                    <option value="SCRATCHED">SCRATCHED</option>
                                  </select>
                                  <button
                                    type="submit"
                                    className="ml-1 rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                  >
                                    Set
                                  </button>
                                </form>
                              </div>
                            ))
                          : contest.sport === "BASKETBALL"
                          ? contest.lanes.map((lane) => (
                              <div
                                key={lane.id}
                                className="flex flex-wrap items-center gap-2 text-xs text-neutral-100"
                              >
                                <form
                                  action={updateBasketballLiveStatsAction}
                                  className="flex flex-1 flex-wrap items-center gap-2"
                                >
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <div className="min-w-[10rem] font-medium text-neutral-100">
                                    {lane.name}
                                    {lane.team ? ` · ${lane.team}` : ""}
                                    {lane.position ? ` · ${lane.position}` : ""}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">PTS</span>
                                      <input
                                        name="basketballPoints"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballPoints ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="POINT"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">3PM</span>
                                      <input
                                        name="basketballThreesMade"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballThreesMade ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="THREE"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">REB</span>
                                      <input
                                        name="basketballRebounds"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballRebounds ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="REB"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">AST</span>
                                      <input
                                        name="basketballAssists"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballAssists ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="AST"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">STL</span>
                                      <input
                                        name="basketballSteals"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballSteals ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="STL"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">BLK</span>
                                      <input
                                        name="basketballBlocks"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballBlocks ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="BLK"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">TOV</span>
                                      <input
                                        name="basketballTurnovers"
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={(lane as any).basketballTurnovers ?? ""}
                                        className="w-14 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                      />
                                      <button
                                        type="submit"
                                        name="stat"
                                        value="TOV"
                                        className="rounded bg-track-100 px-1 py-0.5 text-[10px] font-semibold text-track-700"
                                      >
                                        +1
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-neutral-300">FP</span>
                                      <span className="text-neutral-100">
                                        {(lane as any).liveFantasyPoints != null
                                          ? Number((lane as any).liveFantasyPoints).toFixed(2)
                                          : "0.00"}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="submit"
                                    className="ml-auto rounded bg-track-800 px-2 py-0.5 text-xs font-semibold text-white"
                                  >
                                    Update
                                  </button>
                                </form>
                                <form
                                  action={setLaneStatusAction}
                                  className="flex items-center gap-1"
                                >
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <span className="text-neutral-200">Status</span>
                                  <select
                                    name="status"
                                    defaultValue={lane.status ?? "ACTIVE"}
                                    className="rounded border border-track-200 bg-white px-1 py-0.5 text-[10px] text-track-700"
                                  >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="QUESTIONABLE">QUESTIONABLE</option>
                                    <option value="DOUBTFUL">DOUBTFUL</option>
                                    <option value="SCRATCHED">SCRATCHED</option>
                                  </select>
                                  <button
                                    type="submit"
                                    className="ml-1 rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                  >
                                    Set
                                  </button>
                                </form>
                              </div>
                            ))
                          : contest.sport === "SOCCER"
                          ? contest.lanes.map((lane) =>
                              renderAdminFieldsRow({
                                lane,
                                contestId: contest.id,
                                action: updateSoccerLiveStatsAction,
                                fieldDefs:
                                  ((lane.position ?? "").toUpperCase() === "GK"
                                    ? SOCCER_ADMIN_FIELDS.GOALKEEPER
                                    : SOCCER_ADMIN_FIELDS.OUTFIELD),
                              })
                            )
                          : contest.sport === "FOOTBALL"
                          ? contest.lanes.map((lane) =>
                              renderAdminFieldsRow({
                                lane,
                                contestId: contest.id,
                                action: updateFootballLiveStatsAction,
                                fieldDefs:
                                  (lane.position ?? "").toUpperCase() === "QB"
                                    ? FOOTBALL_ADMIN_FIELDS.QB
                                    : (lane.position ?? "").toUpperCase() === "K"
                                    ? FOOTBALL_ADMIN_FIELDS.K
                                    : (lane.position ?? "").toUpperCase() === "DST" ||
                                      (lane.position ?? "").toUpperCase() === "DEF"
                                    ? FOOTBALL_ADMIN_FIELDS.DST
                                    : FOOTBALL_ADMIN_FIELDS.SKILL,
                              })
                            )
                          : contest.sport === "BASEBALL"
                          ? contest.lanes.map((lane) =>
                              renderAdminFieldsRow({
                                lane,
                                contestId: contest.id,
                                action: updateBaseballLiveStatsAction,
                                fieldDefs:
                                  ["P", "SP", "RP"].includes(
                                    (lane.position ?? "").toUpperCase()
                                  )
                                    ? BASEBALL_ADMIN_FIELDS.PITCHER
                                    : BASEBALL_ADMIN_FIELDS.HITTER,
                              })
                            )
                          : contest.sport === "GOLF"
                          ? contest.lanes.map((lane) =>
                              renderAdminFieldsRow({
                                lane,
                                contestId: contest.id,
                                action: updateGolfLiveStatsAction,
                                fieldDefs: GOLF_ADMIN_FIELDS.GOLFER,
                              })
                            )
                          : contest.lanes.map((lane) => (
                              <div
                                key={lane.id}
                                className="flex flex-wrap items-center gap-2 text-xs text-neutral-100"
                              >
                                <form
                                  action={updateLaneLivePointsAction}
                                  className="flex flex-1 flex-wrap items-center gap-2"
                                >
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <div className="min-w-[10rem] font-medium text-neutral-100">
                                    {lane.name}
                                    {lane.team ? ` · ${lane.team}` : ""}
                                    {lane.position ? ` · ${lane.position}` : ""}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-neutral-200">Live pts</span>
                                    <input
                                      name="liveFantasyPoints"
                                      type="number"
                                      step="0.1"
                                      defaultValue={(lane as any).liveFantasyPoints ?? ""}
                                      className="w-20 rounded border border-track-200 bg-neutral-900 px-1 py-0.5 text-right text-neutral-100"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="submit"
                                      name="delta"
                                      value="1"
                                      className="rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="submit"
                                      name="delta"
                                      value="2"
                                      className="rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                    >
                                      +2
                                    </button>
                                    <button
                                      type="submit"
                                      name="delta"
                                      value="3"
                                      className="rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                    >
                                      +3
                                    </button>
                                    <button
                                      type="submit"
                                      name="delta"
                                      value="-1"
                                      className="rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                    >
                                      -1
                                    </button>
                                  </div>
                                  <button
                                    type="submit"
                                    className="rounded bg-track-800 px-2 py-0.5 text-xs font-semibold text-white"
                                  >
                                    Update
                                  </button>
                                </form>
                                <form
                                  action={setLaneStatusAction}
                                  className="flex items-center gap-1"
                                >
                                  <input type="hidden" name="contestId" value={contest.id} />
                                  <input type="hidden" name="laneId" value={lane.id} />
                                  <span className="text-neutral-200">Status</span>
                                  <select
                                    name="status"
                                    defaultValue={lane.status ?? "ACTIVE"}
                                    className="rounded border border-track-200 bg-white px-1 py-0.5 text-[10px] text-track-700"
                                  >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="QUESTIONABLE">QUESTIONABLE</option>
                                    <option value="DOUBTFUL">DOUBTFUL</option>
                                    <option value="SCRATCHED">SCRATCHED</option>
                                  </select>
                                  <button
                                    type="submit"
                                    className="ml-1 rounded bg-track-100 px-1.5 py-0.5 text-[10px] font-semibold text-track-700"
                                  >
                                    Set
                                  </button>
                                </form>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            </details>
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