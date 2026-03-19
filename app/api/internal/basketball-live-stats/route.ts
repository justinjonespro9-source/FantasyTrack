import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { runBasketballLiveStatsPull } from "@/lib/basketball-live-stats";

/**
 * POST /api/internal/basketball-live-stats
 *
 * Ingests live player stats from the contest's external provider (e.g. SportsDataIO CBB/NBA)
 * and updates lanes' basketball* fields and liveFantasyPoints.
 *
 * Body: { contestId: string }
 * Auth: admin only.
 */
export async function POST(request: Request) {
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

  let body: { contestId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contestId = typeof body.contestId === "string" ? body.contestId.trim() : "";
  if (!contestId) {
    return NextResponse.json({ error: "contestId is required" }, { status: 400 });
  }

  try {
    const result = await runBasketballLiveStatsPull(contestId);
    revalidatePath("/admin");
    revalidatePath(`/contest/${contestId}`);
    revalidatePath("/");
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch live stats from provider.";
    if (message === "Contest not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("externalProvider") || message.includes("externalId")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("Provider does not support")) {
      return NextResponse.json({ error: message }, { status: 501 });
    }
    console.error("Basketball live stats fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch live stats from provider." },
      { status: 502 }
    );
  }
}
