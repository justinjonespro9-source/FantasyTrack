import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getContestOddsData } from "@/lib/market";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: Request, context: RouteContext) {
  const session = await getCurrentSession();
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
