import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SELECTOR_BYTES = 16;
const VERIFIER_BYTES = 16;

function base64UrlDecode(str: string): Buffer | null {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 }
    );
  }

  const tokenBuf = base64UrlDecode(token);
  if (
    !tokenBuf ||
    tokenBuf.length !== SELECTOR_BYTES + VERIFIER_BYTES
  ) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const selector = tokenBuf.subarray(0, SELECTOR_BYTES).toString("hex");
  const verifierBuf = tokenBuf.subarray(SELECTOR_BYTES);
  const verifierForCompare = verifierBuf.toString("base64");

  const now = new Date();
  const record = await prisma.passwordResetToken.findUnique({
    where: { selector },
    include: { user: { select: { id: true } } },
  });

  if (!record || record.expiresAt < now) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const valid = await bcrypt.compare(verifierForCompare, record.tokenHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { id: record.id },
    }),
  ]);

  return NextResponse.json({
    message: "Your password has been reset. You can now sign in with your new password.",
  });
}
