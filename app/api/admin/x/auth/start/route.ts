import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  buildAuthorizeUrl,
  generatePkceVerifier,
  generateState,
  toPkceChallenge,
} from "@/lib/x/oauth";

const STATE_COOKIE = "ft_x_oauth_state";
const VERIFIER_COOKIE = "ft_x_pkce_verifier";
const COOKIE_TTL_SECONDS = 10 * 60;

export async function GET() {
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

  try {
    const state = generateState();
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = toPkceChallenge(codeVerifier);
    const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });

    const response = NextResponse.redirect(authorizeUrl);
    const common = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
    };

    response.cookies.set(STATE_COOKIE, state, common);
    response.cookies.set(VERIFIER_COOKIE, codeVerifier, common);
    return response;
  } catch (error) {
    console.error("[x/oauth/start] failure", error);
    return NextResponse.json({ error: "Unable to start X OAuth." }, { status: 500 });
  }
}
