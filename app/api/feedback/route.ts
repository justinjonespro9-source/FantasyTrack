import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { likes, changes, ideas, email } = await req.json();

    const trimmedLikes = String(likes ?? "").trim();
    const trimmedChanges = String(changes ?? "").trim();
    const trimmedIdeas = String(ideas ?? "").trim();
    const trimmedEmail = String(email ?? "").trim();

    if (!trimmedLikes && !trimmedChanges && !trimmedIdeas) {
      return NextResponse.json(
        { error: "Please share at least one piece of feedback." },
        { status: 400 }
      );
    }

    const session = await getCurrentSession();
    const userId = session?.user?.id ?? null;

    await prisma.feedback.create({
      data: {
        userId,
        email: trimmedEmail || null,
        likes: trimmedLikes,
        changes: trimmedChanges,
        ideas: trimmedIdeas,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error submitting feedback", error);
    return NextResponse.json(
      { error: "Unable to submit feedback right now." },
      { status: 500 }
    );
  }
}

