import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto-secrets";
import { exchangeCodeForTokens, fetchXAccountIdentity, X_PROVIDER_KEY } from "@/lib/x/oauth";

const STATE_COOKIE = "ft_x_oauth_state";
const VERIFIER_COOKIE = "ft_x_pkce_verifier";

/** Use the incoming request origin so localhost port matches (NEXT_PUBLIC_APP_URL mismatches cause hung navigations). */
function redirectUrl(req: NextRequest, pathname: string, search?: Record<string, string>): URL {
  const url = new URL(pathname, req.nextUrl.origin);
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      url.searchParams.set(k, v);
    }
  }
  return url;
}

function logRedirect(outcome: string, pathname: string) {
  console.log("[x/oauth/callback] redirect", { outcome, pathname });
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    logRedirect("forbidden_json", "/api/admin/x/auth/callback");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get(STATE_COOKIE)?.value;
  const codeVerifier = req.cookies.get(VERIFIER_COOKIE)?.value;

  const clearCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  const invalid =
    !code ||
    !returnedState ||
    !storedState ||
    !codeVerifier ||
    returnedState !== storedState;
  if (invalid) {
    const target = redirectUrl(req, "/admin", { xAuth: "error", xReason: "state_mismatch" });
    logRedirect("error_state_mismatch", target.pathname + target.search);
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  }

  try {
    const tokenResponse = await exchangeCodeForTokens({
      code,
      codeVerifier,
    });
    const xIdentity = await fetchXAccountIdentity(tokenResponse.access_token);

    const expiresAt =
      typeof tokenResponse.expires_in === "number"
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

    await prisma.externalProviderToken.upsert({
      where: { provider: X_PROVIDER_KEY },
      create: {
        provider: X_PROVIDER_KEY,
        accessTokenEnc: encryptSecret(tokenResponse.access_token),
        refreshTokenEnc: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
        expiresAt,
        externalAccountId: xIdentity.id,
        externalUsername: xIdentity.username,
        externalDisplayName: xIdentity.displayName,
        updatedByUserId: session.user.id,
      },
      update: {
        accessTokenEnc: encryptSecret(tokenResponse.access_token),
        refreshTokenEnc: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
        expiresAt,
        externalAccountId: xIdentity.id,
        externalUsername: xIdentity.username,
        externalDisplayName: xIdentity.displayName,
        updatedByUserId: session.user.id,
      },
    });

    // Lightweight page: avoids loading the full /admin dashboard (heavy queries + autoLockContests).
    // For raw JSON instead, redirect to `/api/admin/x/auth/complete` (admin-only).
    const target = redirectUrl(req, "/admin/x-oauth-done");
    logRedirect("success", target.pathname);
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  } catch {
    const target = redirectUrl(req, "/admin", { xAuth: "error", xReason: "token_exchange_failed" });
    logRedirect("error_token_exchange", target.pathname + target.search);
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  }
}
