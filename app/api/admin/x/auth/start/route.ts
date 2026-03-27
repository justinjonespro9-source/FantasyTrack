import { NextRequest, NextResponse } from "next/server";
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

/** TEMP: debug — redact OAuth query params (state, PKCE) from URLs in logs. */
function sanitizeAuthorizeUrlForLog(fullUrl: string): string {
  try {
    const u = new URL(fullUrl);
    if (u.searchParams.has("state")) u.searchParams.set("state", "[REDACTED]");
    if (u.searchParams.has("code_challenge")) u.searchParams.set("code_challenge", "[REDACTED]");
    return u.toString();
  } catch {
    return "[invalid authorize URL]";
  }
}

export async function GET(req: NextRequest) {
  console.log("[X START] route hit", {
    method: req.method,
    requestUrl: req.url,
    origin: req.nextUrl.origin,
    host: req.headers.get("host"),
    nodeEnv: process.env.NODE_ENV,
  });

  const envPresent = {
    X_CLIENT_ID: Boolean(process.env.X_CLIENT_ID?.trim()),
    X_CLIENT_SECRET: Boolean(process.env.X_CLIENT_SECRET?.trim()),
    X_REDIRECT_URI: Boolean(process.env.X_REDIRECT_URI?.trim()),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  };
  console.log("[X START] required env present (booleans only)", envPresent);

  const redirectUriFromEnv = process.env.X_REDIRECT_URI?.trim() ?? "";
  if (redirectUriFromEnv) {
    console.log("[X START] X_REDIRECT_URI in use (public callback URL)", redirectUriFromEnv);
  }
  const derivedCallbackFromRequest = `${req.nextUrl.origin}/api/admin/x/auth/callback`;
  console.log("[X START] derived callback URL from this request origin", derivedCallbackFromRequest);
  if (redirectUriFromEnv && derivedCallbackFromRequest !== redirectUriFromEnv) {
    console.error("[X START] redirect URI mismatch risk: X_REDIRECT_URI !== request origin + callback path", {
      envRedirectUri: redirectUriFromEnv,
      derivedCallbackFromRequest,
    });
  }

  const session = await getCurrentSession();
  if (!session?.user?.id) {
    console.error("[X START] abort: no session user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    console.error("[X START] abort: user is not admin", { userId: session.user.id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.log("[X START] admin session ok", { userId: session.user.id });

  try {
    const state = generateState();
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = toPkceChallenge(codeVerifier);
    console.log("[X START] PKCE/state generated (lengths only, not values)", {
      stateLength: state.length,
      codeVerifierLength: codeVerifier.length,
      codeChallengeLength: codeChallenge.length,
    });

    const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
    console.log("[X START] authorization URL (sanitized)", sanitizeAuthorizeUrlForLog(authorizeUrl));

    const response = NextResponse.redirect(authorizeUrl);
    const common = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
    };

    console.log("[X START] storing cookies", {
      stateCookie: STATE_COOKIE,
      verifierCookie: VERIFIER_COOKIE,
      cookieFlags: { httpOnly: common.httpOnly, secure: common.secure, sameSite: common.sameSite, path: common.path, maxAge: common.maxAge },
    });
    response.cookies.set(STATE_COOKIE, state, common);
    response.cookies.set(VERIFIER_COOKIE, codeVerifier, common);

    console.log("[X START] redirecting to X authorize endpoint (sanitized)", sanitizeAuthorizeUrlForLog(authorizeUrl));
    return response;
  } catch (error) {
    console.error("[X START] failure", error);
    return NextResponse.json({ error: "Unable to start X OAuth." }, { status: 500 });
  }
}
