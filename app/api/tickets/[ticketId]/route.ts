import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { TransactionType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { ticketId: string } }
) {
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  );

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = params.ticketId;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      contest: { select: { id: true, title: true, status: true, startTime: true } },
      series: { select: { id: true, name: true } },
      legs: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          market: true,
          amount: true,
          laneId: true,
          laneNameSnap: true,
          teamSnap: true,
          positionSnap: true,
          oddsTo1Snap: true,
          result: true,
          settledAt: true,
          isVoided: true,
          voidReason: true,
          voidedAt: true,
          lane: { select: { name: true } },
        },
      },
      transactions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          type: true,
          amount: true, // BET is typically negative in your system
          ticketId: true,
          ticketLegId: true,
          note: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (!isAdmin && ticket.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ----------------------------
  // Computed helpers
  // ----------------------------

  const betTotal = ticket.transactions
    .filter((t) => t.type === TransactionType.BET)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // "Refund" type name differs by codebase (REFUND/CREDIT/ADJUSTMENT/VOID/etc).
  // We build a list of candidate types, but ONLY keep the ones that exist in your enum.
  const candidateRefundTypes = [
    "REFUND",
    "CREDIT",
    "ADJUSTMENT",
    "REVERSAL",
    "VOID",
  ] as const;

  const refundishTypes = new Set<TransactionType>(
    candidateRefundTypes
      .map((k) => (TransactionType as unknown as Record<string, TransactionType>)[k])
      .filter(Boolean)
  );

  const refundTotal = ticket.transactions
    .filter((t) => refundishTypes.has(t.type))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return NextResponse.json({
    ticket,
    computed: {
      betTotal,
      refundTotal,
    },
  });
}