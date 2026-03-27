import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto-secrets";
import {
  exchangeCodeForTokens,
  fetchXAccountIdentity,
  sanitizeTokenExchangeErrorForUrl,
  X_PROVIDER_KEY,
} from "@/lib/x/oauth";

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

/** TEMP: debug — never log authorization code. */
function sanitizeCallbackUrlForLog(url: URL): string {
  const u = new URL(url.toString());
  if (u.searchParams.has("code")) u.searchParams.set("code", "[REDACTED]");
  if (u.searchParams.has("state")) u.searchParams.set("state", "[REDACTED]");
  return u.toString();
}

export async function GET(req: NextRequest) {
  console.log("[X CALLBACK] route hit", {
    method: req.method,
    callbackUrlSanitized: sanitizeCallbackUrlForLog(req.nextUrl),
    origin: req.nextUrl.origin,
    host: req.headers.get("host"),
    nodeEnv: process.env.NODE_ENV,
  });

  console.log("[X CALLBACK] env present (booleans only)", {
    X_CLIENT_ID: Boolean(process.env.X_CLIENT_ID?.trim()),
    X_CLIENT_SECRET: Boolean(process.env.X_CLIENT_SECRET?.trim()),
    X_REDIRECT_URI: Boolean(process.env.X_REDIRECT_URI?.trim()),
  });
  const redirectUriEnv = process.env.X_REDIRECT_URI?.trim();
  if (redirectUriEnv) {
    console.log("[X CALLBACK] X_REDIRECT_URI in use (must match Twitter app + start flow)", redirectUriEnv);
  }

  const session = await getCurrentSession();
  if (!session?.user?.id) {
    console.error("[X CALLBACK] abort: no session user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) {
    console.error("[X CALLBACK] abort: user is not admin", { userId: session.user.id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  console.log("[X CALLBACK] admin session ok", { userId: session.user.id });

  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get(STATE_COOKIE)?.value;
  const codeVerifier = req.cookies.get(VERIFIER_COOKIE)?.value;

  const hasCode = Boolean(code);
  const hasReturnedState = Boolean(returnedState);
  const hasStoredState = Boolean(storedState);
  const hasVerifier = Boolean(codeVerifier);
  const stateMatches = Boolean(returnedState && storedState && returnedState === storedState);

  console.log("[X CALLBACK] OAuth query + cookie snapshot", {
    hasCode,
    hasReturnedState,
    hasStoredState: hasStoredState,
    hasPkceVerifierCookie: hasVerifier,
    stateMatches,
    returnedStateLength: returnedState?.length ?? 0,
    storedStateLength: storedState?.length ?? 0,
    verifierLength: codeVerifier?.length ?? 0,
  });

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
    console.error("[X CALLBACK] validation failed — redirecting with state_mismatch", {
      missingCode: !code,
      missingReturnedState: !returnedState,
      missingStoredStateCookie: !storedState,
      missingPkceVerifierCookie: !codeVerifier,
      stateMismatch: hasReturnedState && hasStoredState ? returnedState !== storedState : undefined,
    });
    const target = redirectUrl(req, "/admin", { xAuth: "error", xReason: "state_mismatch" });
    console.log("[X CALLBACK] final redirect (error)", {
      destination: target.pathname + target.search,
    });
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  }

  let tokenResponse: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    console.log("[X CALLBACK] token exchange: delegating to lib (see [X OAUTH] logs)");
    tokenResponse = await exchangeCodeForTokens({
      code,
      codeVerifier,
    });
  } catch (tokenErr) {
    console.error("[X CALLBACK] token exchange failed", tokenErr);
    const xDetail = sanitizeTokenExchangeErrorForUrl(tokenErr);
    console.log("[X CALLBACK] redirect after token exchange failure (safe detail only)", { xDetail });
    const target = redirectUrl(req, "/admin", {
      xAuth: "error",
      xReason: "token_exchange_failed",
      xDetail,
    });
    console.log("[X CALLBACK] final redirect (error)", {
      destination: target.pathname + target.search,
    });
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  }

  try {
    console.log("[X CALLBACK] token exchange completed; starting user profile fetch (see [X OAUTH] logs)");
    const xIdentity = await fetchXAccountIdentity(tokenResponse.access_token);

    const expiresAt =
      typeof tokenResponse.expires_in === "number"
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

    console.log("[X CALLBACK] DB upsert externalProviderToken start", {
      provider: X_PROVIDER_KEY,
      externalAccountId: xIdentity.id,
      username: xIdentity.username,
    });

    try {
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
      console.log("[X CALLBACK] DB upsert success", {
        provider: X_PROVIDER_KEY,
        updatedByUserId: session.user.id,
        externalUsernameWritten: Boolean(xIdentity.username?.trim()),
      });
    } catch (dbErr) {
      console.error("[X CALLBACK] DB upsert failed", dbErr);
      throw dbErr;
    }

    try {
      revalidatePath("/admin");
      console.log("[X CALLBACK] revalidatePath(/admin) after successful X token save");
    } catch (revErr) {
      console.error("[X CALLBACK] revalidatePath(/admin) failed (non-fatal)", revErr);
    }

    // Lightweight page: avoids loading the full /admin dashboard (heavy queries + autoLockContests).
    // For raw JSON instead, redirect to `/api/admin/x/auth/complete` (admin-only).
    const target = redirectUrl(req, "/admin/x-oauth-done");
    console.log("[X CALLBACK] final redirect (success)", {
      destination: target.pathname + target.search,
    });
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  } catch (error) {
    console.error("[X CALLBACK] failure after token exchange (profile or DB)", error);
    const target = redirectUrl(req, "/admin", { xAuth: "error", xReason: "oauth_callback_failed" });
    console.log("[X CALLBACK] final redirect (error)", {
      destination: target.pathname + target.search,
    });
    const response = NextResponse.redirect(target);
    response.cookies.set(STATE_COOKIE, "", clearCookie);
    response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
    return response;
  }
}
