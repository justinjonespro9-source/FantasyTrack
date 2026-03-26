import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto-secrets";

const X_POST_URL = "https://api.twitter.com/2/tweets";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = String(body?.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Post text is required." }, { status: 400 });
  }
  if (text.length > 280) {
    return NextResponse.json({ error: "Post text must be 280 characters or fewer." }, { status: 400 });
  }

  const tokenRow = await prisma.externalProviderToken.findUnique({
    where: { provider: "x" },
    select: {
      accessTokenEnc: true,
      externalUsername: true,
    },
  });
  if (!tokenRow?.accessTokenEnc) {
    return NextResponse.json(
      { error: "X is not connected. Connect your account first." },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(tokenRow.accessTokenEnc);
  } catch {
    return NextResponse.json(
      { error: "Stored X token could not be read. Please reconnect X." },
      { status: 500 }
    );
  }

  const xResponse = await fetch(X_POST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });

  const xBody = (await xResponse.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: Array<{ detail?: string; message?: string }>;
    title?: string;
    detail?: string;
  };

  if (!xResponse.ok) {
    const reason =
      xBody?.errors?.[0]?.detail ||
      xBody?.errors?.[0]?.message ||
      xBody?.detail ||
      xBody?.title ||
      `X API request failed (${xResponse.status}).`;
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    postId: xBody?.data?.id ?? null,
    username: tokenRow.externalUsername ?? null,
  });
}
