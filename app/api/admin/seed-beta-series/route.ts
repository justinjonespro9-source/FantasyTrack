import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lightweight admin check; tighten as needed if auth changes.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const seeds = [
    {
      name: "Founders Series",
      inviteCode: "FOUNDERS",
      description: "Private beta series for early FantasyTrack founders and testers.",
    },
    {
      name: "Fraternity Beta",
      inviteCode: "FRAT100",
      description: "Fraternity and friends-only beta league for FantasyTrack.",
    },
    {
      name: "Public Beta",
      inviteCode: "BETA",
      description: "Open beta series for trying FantasyTrack with test coins.",
    },
  ] as const;

  const results: { inviteCode: string; created: boolean; id: string }[] = [];

  for (const seed of seeds) {
    // Use upsert keyed by inviteCode; empty update ensures we never overwrite.
    const series = await prisma.series.upsert({
      where: { inviteCode: seed.inviteCode },
      update: {},
      create: {
        name: seed.name,
        inviteCode: seed.inviteCode,
        description: seed.description,
        startDate: now,
        endDate: sixtyDaysFromNow,
        isActive: true,
      },
    });

    // created flag: true if this was newly inserted (no existing row with that inviteCode)
    // We can infer this by doing a separate existence check first, to avoid relying on metadata.
    const existedBefore = await prisma.series.findFirst({
      where: { inviteCode: seed.inviteCode },
      select: { id: true },
    });

    results.push({
      inviteCode: seed.inviteCode,
      created: !!(series && existedBefore && series.id !== existedBefore.id) ? false : true,
      id: series.id,
    });
  }

  return NextResponse.json({
    ok: true,
    seeds: results,
  });
}

