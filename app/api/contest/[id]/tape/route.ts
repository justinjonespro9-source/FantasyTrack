import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType, TicketStatus } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { canUserAccessSeriesById } from "@/lib/series-access";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentSession();
  const contestId = params.id;
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
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

  // Last 50 BET txs, but only for SUBMITTED tickets + non-voided legs
  const rows = await prisma.transaction.findMany({
    where: {
      contestId,
      type: TransactionType.BET,
      ticketId: { not: null },
      ticket: { status: TicketStatus.SUBMITTED },
      ticketLeg: { isVoided: false },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      amount: true, // negative
      ticketLeg: {
        select: {
          market: true,
          laneNameSnap: true,
          lane: { select: { name: true } },
        },
      },
    },
  });

  const tape = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    market: r.ticketLeg?.market ?? "—",
    lane: r.ticketLeg?.lane?.name ?? r.ticketLeg?.laneNameSnap ?? "—",
    amount: Math.abs(r.amount),
  }));

  return NextResponse.json({ ok: true, tape });
}