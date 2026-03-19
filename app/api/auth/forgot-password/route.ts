import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/email";

const TOKEN_EXPIRY_MINUTES = 60;

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!rawEmail) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const normalizedEmail = rawEmail.toLowerCase();

  // Basic sanity check without leaking whether the email exists.
  if (!normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (user) {
    const { token, tokenHash } = generatePasswordResetToken();
    const selector = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any previous tokens for this user.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        selector,
        tokenHash,
        expiresAt,
        usedAt: null,
      },
    });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        email: normalizedEmail,
        selector,
        token,
      });
    } catch {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      return NextResponse.json(
        { error: "Unable to send reset email. Please try again later." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, a reset link has been sent.",
  });
}
