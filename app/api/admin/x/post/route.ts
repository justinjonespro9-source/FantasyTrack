import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { publishPostToConnectedX, XPostError } from "@/lib/x/post";

export async function POST(req: NextRequest) {
  console.log("[X POST API] POST /api/admin/x/post hit", { path: req.nextUrl.pathname });

  const session = await getCurrentSession();
  if (!session?.user?.id) {
    console.error("[X POST API] unauthorized: no session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    console.error("[X POST API] forbidden: not admin", { userId: session.user.id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { text?: string; contestId?: string };
  try {
    body = await req.json();
  } catch {
    console.error("[X POST API] invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = String(body?.text ?? "").trim();
  const contestId =
    typeof body.contestId === "string" && body.contestId.trim() ? body.contestId.trim() : undefined;
  console.log("[X POST API] invoking publish", {
    textLength: text.length,
    hasContestId: Boolean(contestId),
  });

  try {
    const result = await publishPostToConnectedX(text, contestId ? { contestId } : undefined);
    if (!result.success) {
      console.log("[X POST API] publish skipped (private contest)");
      return NextResponse.json(
        {
          success: false,
          reason: result.reason,
          error: "Cannot post to X for a contest in a private series.",
        },
        { status: 403 }
      );
    }
    console.log("[X POST API] publish ok", {
      hasPostId: Boolean(result.postId),
      hasUsername: Boolean(result.username),
    });
    return NextResponse.json({
      success: true,
      ok: true,
      postId: result.postId,
      username: result.username,
    });
  } catch (err) {
    if (err instanceof XPostError) {
      console.error("[X POST API] publish failed (XPostError)", {
        status: err.status,
        messageLength: err.message.length,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[X POST API] publish failed (unexpected)", err);
    return NextResponse.json(
      { error: "Something went wrong while publishing. Please try again." },
      { status: 500 }
    );
  }
}
