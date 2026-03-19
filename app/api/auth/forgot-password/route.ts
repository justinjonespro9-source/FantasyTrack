import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_EXPIRY_HOURS = 1;
const SELECTOR_BYTES = 16;
const VERIFIER_BYTES = 16;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getBaseUrl(request: Request): string {
  const url = request.url;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  }
}

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

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (user) {
    const selector = randomBytes(SELECTOR_BYTES);
    const verifier = randomBytes(VERIFIER_BYTES);
    const tokenHash = await bcrypt.hash(verifier.toString("base64"), 10);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        selector: selector.toString("hex"),
        tokenHash,
        expiresAt,
      },
    });

    const tokenForLink = base64UrlEncode(Buffer.concat([selector, verifier]));
    const baseUrl = getBaseUrl(request);
    const resetLink = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(tokenForLink)}`;

    // When email is configured (e.g. EMAIL_SERVER_*), send email with resetLink instead of relying on support.
  }

  return NextResponse.json({
    message:
      "If an account exists with that email, we've sent a link to reset your password. Check your inbox and spam folder.",
  });
}
