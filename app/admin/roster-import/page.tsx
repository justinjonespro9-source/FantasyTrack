import Link from "next/link";
import { redirect } from "next/navigation";
import RosterImportPanel from "@/components/admin/roster-import-panel";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: { contestId?: string };
};

export default async function RosterImportAdminPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    redirect("/");
  }

  const requestedContestId =
    typeof searchParams?.contestId === "string" ? searchParams.contestId.trim() : null;

  const contestsRaw = await prisma.contest.findMany({
    orderBy: { startTime: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      sport: true,
      status: true,
      startTime: true,
      contestType: true,
      season: true,
      week: true,
      scoringFormat: true,
      slate: true,
      marketMode: true,
      _count: { select: { lanes: true } },
    },
  });

  let contests = contestsRaw;
  if (requestedContestId && !contestsRaw.some((c) => c.id === requestedContestId)) {
    const requested = await prisma.contest.findUnique({
      where: { id: requestedContestId },
      select: {
        id: true,
        title: true,
        sport: true,
        status: true,
        startTime: true,
        contestType: true,
        season: true,
        week: true,
        scoringFormat: true,
        slate: true,
        marketMode: true,
        _count: { select: { lanes: true } },
      },
    });
    if (requested) contests = [requested, ...contestsRaw];
  }

  const initialBatches = requestedContestId
    ? await prisma.contestImportBatch.findMany({
        where: { contestId: requestedContestId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          sourceLabel: true,
          parsedCount: true,
          importedCount: true,
          skippedCount: true,
          updatedCount: true,
          warningCount: true,
        },
      })
    : contests[0]
      ? await prisma.contestImportBatch.findMany({
          where: { contestId: contests[0].id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            sourceLabel: true,
            parsedCount: true,
            importedCount: true,
            skippedCount: true,
            updatedCount: true,
            warningCount: true,
          },
        })
      : [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-50">AI roster import</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-300">
              Paste a structured FantasyTrack import block to seed contest lanes. Imported ranks and
              projections are for display only — the pari-mutuel pool still sets live odds.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin" className="text-ft-gold hover:underline">
              Admin home
            </Link>
            <Link href="/admin/contest-lanes" className="text-ft-gold hover:underline">
              Lane builder
            </Link>
          </div>
        </div>
      </section>

      <RosterImportPanel
        contests={contests.map((c) => ({
          id: c.id,
          title: c.title,
          sport: c.sport,
          status: c.status,
          startTime: c.startTime.toISOString(),
          contestType: c.contestType,
          season: c.season,
          week: c.week,
          scoringFormat: c.scoringFormat,
          slate: c.slate,
          marketMode: c.marketMode,
          laneCount: c._count.lanes,
        }))}
        initialContestId={requestedContestId ?? undefined}
        initialBatches={initialBatches.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
