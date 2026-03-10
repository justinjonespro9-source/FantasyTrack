import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { createLanesFromPlayers } from "@/lib/sports/contest-lane-bridge";

export async function POST(req: Request) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      contestId?: string;
      playerIds?: string[];
    };

    if (!body.contestId || !Array.isArray(body.playerIds) || body.playerIds.length === 0) {
      return NextResponse.json(
        { error: "contestId and playerIds are required." },
        { status: 400 }
      );
    }

    await createLanesFromPlayers(body.contestId, body.playerIds);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error creating lanes from players", error);
    return NextResponse.json(
      { error: "Unable to create lanes from players." },
      { status: 500 }
    );
  }
}

