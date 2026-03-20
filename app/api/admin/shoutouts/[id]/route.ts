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

type RouteContext = { params: { id: string } };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = context.params.id;
  if (!id) return NextResponse.json({ error: "Missing shoutout id." }, { status: 400 });

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

  const exists = await prisma.shoutout.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await prisma.shoutout.update({
    where: { id },
    data: {
      scope,
      message,
      seriesId: scope === ShoutoutScope.SERIES ? seriesId : null,
      contestId: contestId || null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminSession();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = context.params.id;
  if (!id) return NextResponse.json({ error: "Missing shoutout id." }, { status: 400 });

  const exists = await prisma.shoutout.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  await prisma.shoutout.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

