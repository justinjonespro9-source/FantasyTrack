import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LaneStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      action?: "update" | "remove" | "reorder" | "setStatus";
      contestId?: string;
      laneId?: string;
      name?: string;
      team?: string;
      opponent?: string;
      position?: string;
      depthRole?: string | null;
      seedRank?: number | null;
      projectedPoints?: number | null;
      notes?: string | null;
      status?: string;
      orderedLaneIds?: string[];
    };

    if (!body.contestId || !body.action) {
      return NextResponse.json({ error: "contestId and action are required" }, { status: 400 });
    }

    if (body.action === "reorder") {
      const ids = body.orderedLaneIds ?? [];
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.lane.update({
            where: { id },
            data: { displayOrder: index + 1, seedRank: index + 1 },
          })
        )
      );
    } else if (body.action === "remove") {
      if (!body.laneId) {
        return NextResponse.json({ error: "laneId required" }, { status: 400 });
      }
      const legs = await prisma.ticketLeg.count({
        where: { laneId: body.laneId, isVoided: false },
      });
      if (legs > 0) {
        return NextResponse.json(
          {
            error:
              "This runner already has entries. Scratch/deactivate instead of removing.",
          },
          { status: 409 }
        );
      }
      await prisma.lane.delete({ where: { id: body.laneId } });
    } else if (body.action === "setStatus") {
      if (!body.laneId || !body.status) {
        return NextResponse.json({ error: "laneId and status required" }, { status: 400 });
      }
      if (!Object.values(LaneStatus).includes(body.status as LaneStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      await prisma.lane.update({
        where: { id: body.laneId },
        data: {
          status: body.status as LaneStatus,
          statusUpdatedAt: new Date(),
        },
      });
    } else if (body.action === "update") {
      if (!body.laneId) {
        return NextResponse.json({ error: "laneId required" }, { status: 400 });
      }
      await prisma.lane.update({
        where: { id: body.laneId },
        data: {
          name: body.name?.trim() || undefined,
          team: body.team?.trim() ?? undefined,
          opponent: body.opponent?.trim() ?? undefined,
          position: body.position?.trim() ?? undefined,
          depthRole: body.depthRole?.trim() || null,
          seedRank: body.seedRank ?? null,
          displayOrder: body.seedRank ?? null,
          projectedPoints: body.projectedPoints ?? null,
          notes: body.notes?.trim() || null,
        },
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/contest-field");
    revalidatePath("/admin/roster-import");
    revalidatePath(`/contest/${body.contestId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("contest-field PATCH error", error);
    return NextResponse.json({ error: "Unable to update field" }, { status: 500 });
  }
}
