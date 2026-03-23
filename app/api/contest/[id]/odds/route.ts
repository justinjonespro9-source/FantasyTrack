import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getContestOddsData } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { canUserAccessSeriesById } from "@/lib/series-access";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: Request, context: RouteContext) {
  const session = await getCurrentSession();
  const contest = await prisma.contest.findUnique({
    where: { id: context.params.id },
    select: { id: true, seriesId: true },
  });
  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }
  const access = await canUserAccessSeriesById({
    seriesId: contest.seriesId,
    userId: session?.user?.id ?? null,
    isAdmin: Boolean(session?.user?.isAdmin),
  });
  if (!access.canAccess) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const odds = await getContestOddsData(context.params.id, session?.user?.id ?? null);

  if (!odds) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  if (!session?.user?.id) {
    odds.myCoinsUsedInContest = 0;
    odds.myCoinsRemainingInContest = 0;
  }

  return NextResponse.json(odds);
}
