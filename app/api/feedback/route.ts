import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const userId = session?.user?.id ?? null;

    const body = await request.json().catch(() => ({}));
    const likes = typeof body.likes === "string" ? body.likes.trim() : "";
    const changes = typeof body.changes === "string" ? body.changes.trim() : "";
    const ideas = typeof body.ideas === "string" ? body.ideas.trim() : "";
    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const email = emailRaw.length > 0 ? emailRaw : null;

    if (!likes && !changes && !ideas) {
      return NextResponse.json(
        { error: "Please share at least one piece of feedback." },
        { status: 400 }
      );
    }

    const maxTextLen = 4000;
    const safeLikes = likes.slice(0, maxTextLen);
    const safeChanges = changes.slice(0, maxTextLen);
    const safeIdeas = ideas.slice(0, maxTextLen);

    await prisma.feedback.create({
      data: {
        userId,
        email,
        likes: safeLikes,
        changes: safeChanges,
        ideas: safeIdeas,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error handling feedback:", err);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again later." },
      { status: 500 }
    );
  }
}
