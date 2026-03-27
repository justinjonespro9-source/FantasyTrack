import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
export const X_PROVIDER_KEY = "x";

/** TEMP: debug — truncate bodies for Vercel logs; never log tokens. */
function truncateForLog(s: string, max = 400): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/**
 * TEMP: short safe token for /admin URL when token exchange fails.
 * Uses OAuth `error` codes from JSON only — never error_description, tokens, or raw bodies.
 */
export function sanitizeTokenExchangeErrorForUrl(error: unknown): string {
  const MAX = 80;
  const msg = error instanceof Error ? error.message : String(error);

  const httpMatch = msg.match(/^X token exchange failed \((\d+)\):\s*([\s\S]*)$/);
  if (httpMatch) {
    const status = httpMatch[1];
    const body = httpMatch[2].trim();
    try {
      const j = JSON.parse(body) as { error?: string };
      if (typeof j.error === "string") {
        const code = j.error.trim();
        if (/^[a-z][a-z0-9_]*$/i.test(code) && code.length <= 64) {
          return code.slice(0, MAX);
        }
      }
    } catch {
      /* body not JSON */
    }
    return `http_${status}`.slice(0, MAX);
  }

  if (msg.includes("X token exchange returned non-JSON")) {
    return "non_json_response".slice(0, MAX);
  }
  if (msg.includes("X token exchange response missing required fields")) {
    return "missing_token_fields".slice(0, MAX);
  }

  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(msg)) {
    return "network_error".slice(0, MAX);
  }

  return "unknown".slice(0, MAX);
}

/**
 * TEMP: short safe token for /admin URL when X users/me (profile) step fails.
 * Never includes API response bodies.
 */
export function sanitizeProfileFetchErrorForUrl(error: unknown): string {
  const MAX = 80;
  const msg = error instanceof Error ? error.message : String(error);

  const httpMatch = msg.match(/^X identity fetch failed \((\d+)\):/);
  if (httpMatch) {
    const n = Number(httpMatch[1]);
    if (n === 401) return "unauthorized".slice(0, MAX);
    if (n === 403) return "forbidden".slice(0, MAX);
    if (n === 404) return "not_found".slice(0, MAX);
    if (n === 429) return "http_429".slice(0, MAX);
    return `http_${n}`.slice(0, MAX);
  }

  if (msg.includes("X identity fetch returned non-JSON")) {
    return "non_json_response".slice(0, MAX);
  }
  if (msg.includes("X identity response missing id/username")) {
    return "unknown".slice(0, MAX);
  }

  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(msg)) {
    return "network_error".slice(0, MAX);
  }

  return "unknown".slice(0, MAX);
}

/**
 * TEMP: short safe token for /admin URL when ExternalProviderToken upsert fails.
 */
export function sanitizeDbUpsertErrorForUrl(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "unique_constraint";
    if (error.code === "P2011") return "null_constraint";
    return "prisma_error";
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return "prisma_error";
  }

  const msg = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection|server has closed|P1001|P1002|P1017/i.test(msg)) {
    return "db_connection";
  }
  if (/column .* does not exist|Unknown column|does not exist in the current database/i.test(msg)) {
    return "missing_column";
  }

  return "unknown";
}

const DEFAULT_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

function requiredEnv(name: "X_CLIENT_ID" | "X_CLIENT_SECRET" | "X_REDIRECT_URI"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function base64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateState(): string {
  return base64Url(randomBytes(24));
}

export function generatePkceVerifier(): string {
  return base64Url(randomBytes(48));
}

export function toPkceChallenge(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest();
  return base64Url(digest);
}

export function buildAuthorizeUrl(args: { state: string; codeChallenge: string }): string {
  const clientId = requiredEnv("X_CLIENT_ID");
  const redirectUri = requiredEnv("X_REDIRECT_URI");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES.join(" "),
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

type XTokenResponse = {
  token_type: string;
  expires_in?: number;
  access_token: string;
  scope?: string;
  refresh_token?: string;
};

type XMeResponse = {
  data?: {
    id?: string;
    username?: string;
    name?: string;
  };
};

export async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier: string;
}): Promise<XTokenResponse> {
  const clientId = requiredEnv("X_CLIENT_ID");
  const clientSecret = requiredEnv("X_CLIENT_SECRET");
  const redirectUri = requiredEnv("X_REDIRECT_URI");

  console.log("[X OAUTH] token exchange start", {
    tokenUrl: X_TOKEN_URL,
    redirectUriUsed: redirectUri,
    codeLength: args.code.length,
    codeVerifierLength: args.codeVerifier.length,
  });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: args.codeVerifier,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(X_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[X OAUTH] token exchange fetch threw (network)", err);
    throw err;
  }

  const raw = await response.text();

  if (!response.ok) {
    console.error("[X OAUTH] token exchange HTTP error", {
      status: response.status,
      bodySnippet: truncateForLog(raw),
    });
    throw new Error(`X token exchange failed (${response.status}): ${raw}`);
  }

  console.log("[X OAUTH] token exchange HTTP ok", { status: response.status });

  let data: Partial<XTokenResponse>;
  try {
    data = JSON.parse(raw) as Partial<XTokenResponse>;
  } catch (parseErr) {
    console.error("[X OAUTH] token exchange non-JSON body", { bodySnippet: truncateForLog(raw) });
    throw new Error(`X token exchange returned non-JSON: ${raw}`);
  }

  if (!data.access_token || !data.token_type) {
    console.error("[X OAUTH] token exchange JSON missing access_token or token_type", {
      keys: Object.keys(data),
    });
    throw new Error("X token exchange response missing required fields.");
  }

  console.log("[X OAUTH] token exchange success (no secrets logged)", {
    tokenType: data.token_type,
    hasRefreshToken: Boolean(data.refresh_token),
    expiresIn: data.expires_in,
    scope: data.scope,
  });

  return {
    token_type: data.token_type,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
    expires_in: data.expires_in,
  };
}

export async function fetchXAccountIdentity(accessToken: string): Promise<{
  id: string;
  username: string;
  displayName: string;
}> {
  const meUrl = "https://api.twitter.com/2/users/me?user.fields=username,name";
  console.log("[X OAUTH] user profile fetch start", { url: meUrl });

  let response: Response;
  try {
    response = await fetch(meUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[X OAUTH] user profile fetch threw (network)", err);
    throw err;
  }

  const raw = await response.text();

  if (!response.ok) {
    console.error("[X OAUTH] user profile fetch HTTP error", {
      status: response.status,
      bodySnippet: truncateForLog(raw),
    });
    throw new Error(`X identity fetch failed (${response.status}): ${raw}`);
  }

  let body: XMeResponse;
  try {
    body = JSON.parse(raw) as XMeResponse;
  } catch (parseErr) {
    console.error("[X OAUTH] user profile non-JSON body", { bodySnippet: truncateForLog(raw) });
    throw new Error(`X identity fetch returned non-JSON: ${raw}`);
  }

  const id = body.data?.id?.trim();
  const username = body.data?.username?.trim();
  const displayName = body.data?.name?.trim();

  if (!id || !username) {
    console.error("[X OAUTH] user profile missing id/username in JSON", {
      bodySnippet: truncateForLog(raw),
    });
    throw new Error(`X identity response missing id/username: ${raw}`);
  }

  console.log("[X OAUTH] user profile fetch success", {
    externalAccountId: id,
    username,
    hasDisplayName: Boolean(displayName),
  });

  return {
    id,
    username,
    displayName: displayName || username,
  };
}

