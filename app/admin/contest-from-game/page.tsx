import { redirect } from "next/navigation";
import Link from "next/link";
import ContestFromGameForm from "@/components/admin/contest-from-game-form";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ContestFromGameAdminPage() {
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

  const [leagues, seriesList] = await Promise.all([
    prisma.league.findMany({
      orderBy: [{ sport: "asc" }, { code: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        sport: true,
        externalId: true,
      },
    }),
    prisma.series.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  const leagueOptions = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    sport: l.sport,
    externalId: l.externalId,
  }));

  const seriesOptions = seriesList.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-50">
            Create contest from game
          </h1>
          <p className="text-sm text-neutral-300">
            Choose a sport, league, and series, then load games from the imported
            schedule. Create a FantasyTrack contest pre-linked to the correct sport,
            teams, and external provider. Lanes are not created here; use the lane
            builder after creating the contest.
          </p>
          <p className="text-xs text-neutral-500">
            <Link href="/admin" className="text-amber-400/80 hover:text-amber-300">
              ← Admin
            </Link>
            {" · "}
            <Link
              href="/admin/contest-lanes"
              className="text-amber-400/80 hover:text-amber-300"
            >
              Contest lane builder
            </Link>
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-5">
        <ContestFromGameForm leagues={leagueOptions} seriesList={seriesOptions} />
      </section>
    </div>
  );
}
