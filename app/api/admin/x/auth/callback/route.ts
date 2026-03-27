import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

function adminOAuthErrorRedirect(req: NextRequest, code: "session" | "token" | "profile" | "save") {
  const clearCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  const target = redirectUrl(req, "/admin", { x_oauth_error: code });
  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, "", clearCookie);
  response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
  return response;
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
    return adminOAuthErrorRedirect(req, "session");
  }

  let tokenResponse: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokenResponse = await exchangeCodeForTokens({
      code,
      codeVerifier,
    });
  } catch {
    return adminOAuthErrorRedirect(req, "token");
  }

  let xIdentity: Awaited<ReturnType<typeof fetchXAccountIdentity>>;
  try {
    xIdentity = await fetchXAccountIdentity(tokenResponse.access_token);
  } catch {
    return adminOAuthErrorRedirect(req, "profile");
  }

  const expiresAt =
    typeof tokenResponse.expires_in === "number"
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

  let accessTokenEnc: string;
  let refreshTokenEnc: string | null;
  try {
    accessTokenEnc = encryptSecret(tokenResponse.access_token);
    refreshTokenEnc = tokenResponse.refresh_token
      ? encryptSecret(tokenResponse.refresh_token)
      : null;
  } catch {
    return adminOAuthErrorRedirect(req, "save");
  }

  try {
    await prisma.externalProviderToken.upsert({
      where: { provider: X_PROVIDER_KEY },
      create: {
        provider: X_PROVIDER_KEY,
        accessTokenEnc,
        refreshTokenEnc,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
        expiresAt,
        externalAccountId: xIdentity.id,
        externalUsername: xIdentity.username,
        externalDisplayName: xIdentity.displayName,
        updatedByUserId: session.user.id,
      },
      update: {
        accessTokenEnc,
        refreshTokenEnc,
        tokenType: tokenResponse.token_type ?? null,
        scope: tokenResponse.scope ?? null,
        expiresAt,
        externalAccountId: xIdentity.id,
        externalUsername: xIdentity.username,
        externalDisplayName: xIdentity.displayName,
        updatedByUserId: session.user.id,
      },
    });
  } catch {
    return adminOAuthErrorRedirect(req, "save");
  }

  try {
    revalidatePath("/admin");
  } catch {
    /* non-fatal */
  }

  const target = redirectUrl(req, "/admin/x-oauth-done");
  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, "", clearCookie);
  response.cookies.set(VERIFIER_COOKIE, "", clearCookie);
  return response;
}
