import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { inviteCode } = await req.json();
    const raw = String(inviteCode ?? "").trim();

    if (!raw) {
      return NextResponse.json({ error: "Enter an invite code." }, { status: 400 });
    }

    const code = raw.toUpperCase();

    const series = await prisma.series.findFirst({
      where: { inviteCode: code },
      select: { id: true, name: true },
    });

    if (!series) {
      return NextResponse.json({ error: "Invite code not found." }, { status: 404 });
    }

    const existing = await prisma.seriesMembership.findFirst({
      where: {
        seriesId: series.id,
        userId: session.user.id,
      },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyMember: true,
        seriesId: series.id,
        seriesName: series.name,
      });
    }

    await prisma.seriesMembership.create({
      data: {
        seriesId: series.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      seriesId: series.id,
      seriesName: series.name,
    });
  } catch (error) {
    console.error("Error joining series by invite code", error);
    return NextResponse.json(
      { error: "Unable to join series right now." },
      { status: 500 }
    );
  }
}

