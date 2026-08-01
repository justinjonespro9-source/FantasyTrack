import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  importFantasyTrackRoster,
  updateContestImportShell,
  type DuplicateMode,
  type EditableImportRow,
} from "@/lib/roster-import";

async function requireAdminUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: dbUser.id };
}

export async function GET(req: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth && auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const contestId = searchParams.get("contestId")?.trim();
  if (!contestId) {
    return NextResponse.json({ error: "contestId is required" }, { status: 400 });
  }

  const batches = await prisma.contestImportBatch.findMany({
    where: { contestId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      sourceLabel: true,
      parserVersion: true,
      parsedCount: true,
      importedCount: true,
      skippedCount: true,
      updatedCount: true,
      warningCount: true,
      errorCount: true,
      parsedMetadata: true,
      importedByUserId: true,
    },
  });

  return NextResponse.json({ batches });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      contestId?: string;
      contestType?: string | null;
      season?: number | null;
      week?: number | null;
      scoringFormat?: string | null;
      slate?: string | null;
      marketMode?: string | null;
    };

    if (!body.contestId) {
      return NextResponse.json({ error: "contestId is required" }, { status: 400 });
    }

    const contest = await updateContestImportShell({
      contestId: body.contestId,
      contestType: body.contestType,
      season: body.season,
      week: body.week,
      scoringFormat: body.scoringFormat,
      slate: body.slate,
      marketMode: body.marketMode,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/roster-import");
    revalidatePath(`/contest/${body.contestId}`);

    return NextResponse.json({ ok: true, contest });
  } catch (error) {
    console.error("Error updating contest import shell", error);
    return NextResponse.json(
      { error: "Unable to update contest settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      contestId?: string;
      rawText?: string;
      rows?: EditableImportRow[];
      duplicateMode?: DuplicateMode;
      expectedRoles?: string[];
    };

    if (!body.contestId || typeof body.rawText !== "string") {
      return NextResponse.json(
        { error: "contestId and rawText are required." },
        { status: 400 }
      );
    }

    const result = await importFantasyTrackRoster({
      contestId: body.contestId,
      rawText: body.rawText,
      rows: body.rows,
      duplicateMode: body.duplicateMode ?? "SKIP",
      importedByUserId: auth.userId!,
      expectedRoles: body.expectedRoles,
    });

    if (result.success) {
      revalidatePath("/admin");
      revalidatePath("/admin/roster-import");
      revalidatePath(`/contest/${body.contestId}`);
      revalidatePath("/");
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Error importing roster", error);
    return NextResponse.json(
      {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        updatedCount: 0,
        warningCount: 0,
        errors: [{ message: "Unable to import roster." }],
      },
      { status: 500 }
    );
  }
}
