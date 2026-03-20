import { NextRequest, NextResponse } from "next/server";
import { ShoutoutScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 } as const;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) return { error: "Forbidden", status: 403 } as const;

  return { session } as const;
}

export async function GET() {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const shoutouts = await prisma.shoutout.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      series: { select: { id: true, name: true } },
      contest: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    shoutouts: shoutouts.map((s) => ({
      id: s.id,
      scope: s.scope,
      message: s.message,
      createdAt: s.createdAt.toISOString(),
      seriesId: s.seriesId,
      seriesName: s.series?.name ?? null,
      contestId: s.contestId,
      contestTitle: s.contest?.title ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { scope?: string; seriesId?: string | null; contestId?: string | null; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope = body.scope === "GLOBAL" ? ShoutoutScope.GLOBAL : ShoutoutScope.SERIES;
  const seriesId = (body.seriesId ?? "").trim();
  const contestId = (body.contestId ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (scope === ShoutoutScope.SERIES && !seriesId) {
    return NextResponse.json({ error: "Series is required for series posts." }, { status: 400 });
  }

  if (scope === ShoutoutScope.SERIES && seriesId) {
    const exists = await prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  const shoutout = await prisma.shoutout.create({
    data: {
      scope,
      seriesId: scope === ShoutoutScope.SERIES ? seriesId : null,
      contestId: contestId || null,
      message,
      createdByAdminId: auth.session.user.id,
    },
    include: {
      series: { select: { id: true, name: true } },
      contest: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    shoutout: {
      id: shoutout.id,
      scope: shoutout.scope,
      message: shoutout.message,
      createdAt: shoutout.createdAt.toISOString(),
      seriesId: shoutout.seriesId,
      seriesName: shoutout.series?.name ?? null,
      contestId: shoutout.contestId,
      contestTitle: shoutout.contest?.title ?? null,
    },
  });
}

