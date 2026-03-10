import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getContestOddsData } from "@/lib/market";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
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
