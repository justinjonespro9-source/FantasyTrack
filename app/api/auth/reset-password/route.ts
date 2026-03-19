import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function POST(request: Request) {
  let body: { email?: string; selector?: string; token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const email = rawEmail.toLowerCase();
  const selector = typeof body.selector === "string" ? body.selector.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!selector || !token) {
    return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 }
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired." },
      { status: 400 }
    );
  }

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      selector,
      tokenHash,
      expiresAt: { gte: now },
      usedAt: null,
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, id: { not: record.id } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
  });
}
