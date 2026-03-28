import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto-secrets";
import { refreshXAccessToken, X_PROVIDER_KEY } from "@/lib/x/oauth";

const X_POST_URL = "https://api.twitter.com/2/tweets";
const MAX_X_POST_CHARS = 280;
/** Refresh access token this long before stored expiry to avoid edge failures. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function truncateForLog(s: string, max = 240): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function isExpiredOrNearExpiry(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - EXPIRY_BUFFER_MS <= Date.now();
}

export class XPostError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Contests inherit visibility from their series; private series must not post to X. */
export type PublishPostToXResult =
  | { success: true; postId: string | null; username: string | null }
  | { success: false; reason: "private_contest" };

type ParsedTweetResponse = {
  xBody: {
    data?: { id?: string };
    errors?: Array<{ detail?: string; message?: string; title?: string; code?: number }>;
    title?: string;
    detail?: string;
    status?: number;
  };
  rawText: string;
};

function parseTweetResponse(rawText: string, httpStatus: number): ParsedTweetResponse {
  let xBody: ParsedTweetResponse["xBody"] = {};
  if (rawText.trim()) {
    try {
      xBody = JSON.parse(rawText) as ParsedTweetResponse["xBody"];
    } catch {
      console.error("[X POST SEND] X response not JSON", {
        httpStatus,
        bodySnippet: truncateForLog(rawText),
      });
    }
  }
  return { xBody, rawText };
}

async function persistTokensAfterRefresh(
  tokens: Awaited<ReturnType<typeof refreshXAccessToken>>
): Promise<void> {
  const expiresAt =
    typeof tokens.expires_in === "number"
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

  await prisma.externalProviderToken.update({
    where: { provider: X_PROVIDER_KEY },
    data: {
      accessTokenEnc: encryptSecret(tokens.access_token),
      tokenType: tokens.token_type ?? null,
      scope: tokens.scope ?? null,
      expiresAt,
      ...(tokens.refresh_token ? { refreshTokenEnc: encryptSecret(tokens.refresh_token) } : {}),
    },
  });
}

async function runRefreshAndPersist(refreshPlain: string): Promise<{
  accessToken: string;
  refreshPlain: string;
}> {
  console.log("[X POST SEND] refresh attempt start");
  try {
    const tokens = await refreshXAccessToken(refreshPlain);
    console.log("[X POST SEND] refresh success", {
      hasNewRefreshToken: Boolean(tokens.refresh_token),
      expiresInSec: typeof tokens.expires_in === "number" ? tokens.expires_in : null,
    });
    await persistTokensAfterRefresh(tokens);
    return {
      accessToken: tokens.access_token,
      refreshPlain: tokens.refresh_token ?? refreshPlain,
    };
  } catch (e) {
    console.error("[X POST SEND] refresh failed", e instanceof Error ? e.message : "unknown");
    throw e;
  }
}

async function postTweet(accessToken: string, text: string): Promise<Response> {
  return fetch(X_POST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
}

function throwIfTweetError(xResponse: Response, parsed: ParsedTweetResponse): void {
  const { xBody } = parsed;
  const firstErr = xBody.errors?.[0];
  const sanitizedXReason =
    firstErr?.detail ||
    firstErr?.message ||
    firstErr?.title ||
    xBody.detail ||
    xBody.title ||
    null;

  if (xResponse.ok) return;

  console.error("[X POST SEND] X API error response", {
    httpStatus: xResponse.status,
    sanitizedReason: sanitizedXReason ? truncateForLog(String(sanitizedXReason)) : null,
    errorCode: firstErr?.code ?? null,
  });

  if (xResponse.status === 401 || xResponse.status === 403) {
    throw new XPostError(
      "X rejected this request (session may have expired). Reconnect X from Admin and try again.",
      xResponse.status
    );
  }

  const userMsg = sanitizedXReason
    ? String(sanitizedXReason).trim().slice(0, 280)
    : `X could not publish this post (status ${xResponse.status}).`;
  throw new XPostError(
    userMsg,
    xResponse.status >= 400 && xResponse.status < 600 ? xResponse.status : 400
  );
}

export async function publishPostToConnectedX(
  text: string,
  options?: { contestId?: string }
): Promise<PublishPostToXResult> {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    throw new XPostError("Post text is required.", 400);
  }
  if (normalized.length > MAX_X_POST_CHARS) {
    throw new XPostError("Post text must be 280 characters or fewer.", 400);
  }

  const contestIdOpt = options?.contestId?.trim();
  if (contestIdOpt) {
    const contest = await prisma.contest.findUnique({
      where: { id: contestIdOpt },
      select: { series: { select: { isPrivate: true } } },
    });
    if (!contest) {
      throw new XPostError("Contest not found.", 404);
    }
    if (contest.series.isPrivate) {
      console.log("[X POST SEND] skipped private contest", { contestId: contestIdOpt });
      return { success: false, reason: "private_contest" };
    }
  }

  console.log("[X POST SEND] publish start", {
    textLength: normalized.length,
    provider: X_PROVIDER_KEY,
    hasContestGuard: Boolean(contestIdOpt),
  });

  const tokenRow = await prisma.externalProviderToken.findUnique({
    where: { provider: X_PROVIDER_KEY },
    select: {
      accessTokenEnc: true,
      refreshTokenEnc: true,
      expiresAt: true,
      externalUsername: true,
    },
  });

  const hasSavedRow = Boolean(tokenRow);
  const hasEncryptedAccessToken = Boolean(tokenRow?.accessTokenEnc);
  const hasEncryptedRefreshToken = Boolean(tokenRow?.refreshTokenEnc);
  console.log("[X POST SEND] token row loaded", {
    hasSavedRow,
    hasEncryptedAccessToken,
    hasEncryptedRefreshToken,
    hasUsername: Boolean(tokenRow?.externalUsername?.trim()),
    hasExpiresAt: Boolean(tokenRow?.expiresAt),
  });

  if (!tokenRow?.accessTokenEnc) {
    console.error("[X POST SEND] abort: no saved X connection or missing encrypted token");
    throw new XPostError("X is not connected. Connect your account first.", 400);
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(tokenRow.accessTokenEnc);
    console.log("[X POST SEND] access token decrypt succeeded");
  } catch (decryptErr) {
    console.error("[X POST SEND] access token decrypt failed", decryptErr);
    throw new XPostError("Stored X token could not be read. Please reconnect X.", 500);
  }

  let refreshPlain: string | null = null;
  if (tokenRow.refreshTokenEnc) {
    try {
      refreshPlain = decryptSecret(tokenRow.refreshTokenEnc);
    } catch {
      console.error("[X POST SEND] refresh token decrypt failed");
      refreshPlain = null;
    }
  }

  if (refreshPlain && isExpiredOrNearExpiry(tokenRow.expiresAt)) {
    console.log("[X POST SEND] token appears expired or near expiry", {
      expiresAtIso: tokenRow.expiresAt?.toISOString() ?? null,
    });
    try {
      const r = await runRefreshAndPersist(refreshPlain);
      accessToken = r.accessToken;
      refreshPlain = r.refreshPlain;
    } catch {
      throw new XPostError(
        "Could not refresh your X session. Reconnect X from Admin and try again.",
        401
      );
    }
  }

  let xResponse = await postTweet(accessToken, normalized);
  let rawText = await xResponse.text();
  let parsed = parseTweetResponse(rawText, xResponse.status);

  if (!xResponse.ok && xResponse.status === 401 && refreshPlain) {
    console.log("[X POST SEND] retry publish after refresh (401)");
    try {
      const r = await runRefreshAndPersist(refreshPlain);
      accessToken = r.accessToken;
      xResponse = await postTweet(accessToken, normalized);
      rawText = await xResponse.text();
      parsed = parseTweetResponse(rawText, xResponse.status);
    } catch {
      throw new XPostError(
        "Could not refresh your X session after a failed post. Reconnect X from Admin.",
        401
      );
    }
  }

  if (!xResponse.ok) {
    throwIfTweetError(xResponse, parsed);
  }

  console.log("[X POST SEND] X API success", {
    httpStatus: xResponse.status,
    hasPostId: Boolean(parsed.xBody?.data?.id),
  });

  return {
    success: true,
    postId: parsed.xBody?.data?.id ?? null,
    username: tokenRow.externalUsername ?? null,
  };
}
