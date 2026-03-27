import { createHash, randomBytes } from "crypto";

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
export const X_PROVIDER_KEY = "x";

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

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: args.codeVerifier,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
    cache: "no-store",
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`X token exchange failed (${response.status}): ${raw}`);
  }

  let data: Partial<XTokenResponse>;
  try {
    data = JSON.parse(raw) as Partial<XTokenResponse>;
  } catch {
    throw new Error(`X token exchange returned non-JSON: ${raw}`);
  }

  if (!data.access_token || !data.token_type) {
    throw new Error("X token exchange response missing required fields.");
  }

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
  const response = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=username,name",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`X identity fetch failed (${response.status}): ${raw}`);
  }

  let body: XMeResponse;
  try {
    body = JSON.parse(raw) as XMeResponse;
  } catch {
    throw new Error(`X identity fetch returned non-JSON: ${raw}`);
  }

  const id = body.data?.id?.trim();
  const username = body.data?.username?.trim();
  const displayName = body.data?.name?.trim();

  if (!id || !username) {
    throw new Error(`X identity response missing id/username: ${raw}`);
  }

  return {
    id,
    username,
    displayName: displayName || username,
  };
}

