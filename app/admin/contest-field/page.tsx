import Link from "next/link";
import { redirect } from "next/navigation";
import ContestFieldReview from "@/components/admin/contest-field-review";
import { formatMultiple } from "@/lib/format";
import { getContestOddsData } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: { contestId?: string };
};

export default async function ContestFieldAdminPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/auth/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) redirect("/");

  const contestId = searchParams?.contestId?.trim();
  if (!contestId) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <h1 className="text-xl font-semibold text-neutral-50">Contest field review</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Select a contest from Admin, or open Field review from a contest row.
        </p>
        <Link href="/admin" className="mt-4 inline-block text-ft-gold hover:underline">
          Back to admin
        </Link>
      </div>
    );
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      lanes: {
        orderBy: [{ displayOrder: "asc" }, { seedRank: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!contest) redirect("/admin");

  const odds = await getContestOddsData(contest.id);
  const entryGroups = await prisma.ticketLeg.groupBy({
    by: ["laneId"],
    where: { contestId: contest.id, isVoided: false },
    _count: { _all: true },
  });
  const entryByLane = new Map(entryGroups.map((g) => [g.laneId, g._count._all]));

  const positionHint =
    contest.lanes.find((l) => l.position)?.position ??
    null;

  const poolTotal =
    (odds?.poolTotals.WIN ?? 0) +
    (odds?.poolTotals.PLACE ?? 0) +
    (odds?.poolTotals.SHOW ?? 0);

  const ticketCount = await prisma.ticket.count({
    where: { contestId: contest.id, status: { not: "VOIDED" } },
  });

  return (
    <ContestFieldReview
      contest={{
        id: contest.id,
        title: contest.title,
        status: contest.status,
        sport: contest.sport,
        season: contest.season,
        week: contest.week,
        scoringFormat: contest.scoringFormat,
        slate: contest.slate,
        startTime: contest.startTime.toISOString(),
        positionHint,
      }}
      poolTotal={poolTotal}
      entryCount={ticketCount}
      initialLanes={contest.lanes.map((lane) => {
        const winTotal = odds?.laneTotals[lane.id]?.WIN ?? 0;
        const multiple = odds?.estMultiples[lane.id]?.WIN ?? null;
        return {
          id: lane.id,
          name: lane.name,
          team: lane.team,
          opponent: lane.opponent,
          position: lane.position,
          depthRole: lane.depthRole,
          seedRank: lane.seedRank,
          displayOrder: lane.displayOrder,
          projectedPoints: lane.projectedPoints,
          notes: lane.notes,
          status: lane.status,
          poolAmount: winTotal,
          entryCount: entryByLane.get(lane.id) ?? 0,
          currentOddsLabel:
            multiple == null ? "Not established" : formatMultiple(multiple),
        };
      })}
    />
  );
}
