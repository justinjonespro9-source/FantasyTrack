import { redirect } from "next/navigation";
import ContestLaneBuilder from "@/components/admin/contest-lane-builder";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { contestId?: string };
};

export default async function ContestLanesAdminPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    redirect("/"); // non-admins get bounced to homepage
  }

  const requestedContestId =
    typeof searchParams?.contestId === "string" ? searchParams.contestId.trim() : null;

  const [contestsRaw, leagues] = await Promise.all([
    prisma.contest.findMany({
      orderBy: { startTime: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        sport: true,
        startTime: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    }),
    prisma.league.findMany({
      orderBy: { sport: "asc" },
      include: {
        teams: {
          orderBy: { name: "asc" },
          include: {
            players: {
              where: { active: true },
              orderBy: { fullName: "asc" },
            },
          },
        },
      },
    }),
  ]);

  let contests = contestsRaw;
  if (requestedContestId && !contestsRaw.some((c) => c.id === requestedContestId)) {
    const requested = await prisma.contest.findUnique({
      where: { id: requestedContestId },
      select: {
        id: true,
        title: true,
        sport: true,
        startTime: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    });
    if (requested) {
      contests = [requested, ...contestsRaw];
    }
  }

  const contestOptions = contests.map((c) => ({
    id: c.id,
    title: c.title,
    sport: c.sport,
    startTime: c.startTime.toISOString(),
    homeTeamId: c.homeTeamId,
    awayTeamId: c.awayTeamId,
  }));

  const leagueOptions = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    sport: l.sport,
    code: l.code,
    teams: l.teams.map((t) => ({
      id: t.id,
      name: t.name,
      market: t.market,
      abbreviation: t.abbreviation,
      players: t.players.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        position: p.position,
      })),
    })),
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-50">Contest lane builder</h1>
          <p className="text-sm text-neutral-300">
            Use imported leagues, teams, and players to create FantasyTrack lanes for a contest.
            This does not change settlement or odds logic; it only seeds lanes from player data.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5">
        <ContestLaneBuilder
          contests={contestOptions}
          leagues={leagueOptions}
          initialContestId={requestedContestId ?? undefined}
        />
      </section>
    </div>
  );
}

