import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";
import { X_PROVIDER_KEY } from "@/lib/x/oauth";

const X_POST_URL = "https://api.twitter.com/2/tweets";
const MAX_X_POST_CHARS = 280;

function truncateForLog(s: string, max = 240): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export class XPostError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function publishPostToConnectedX(text: string): Promise<{
  postId: string | null;
  username: string | null;
}> {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    throw new XPostError("Post text is required.", 400);
  }
  if (normalized.length > MAX_X_POST_CHARS) {
    throw new XPostError("Post text must be 280 characters or fewer.", 400);
  }

  console.log("[X POST SEND] publish start", {
    textLength: normalized.length,
    provider: X_PROVIDER_KEY,
  });

  const tokenRow = await prisma.externalProviderToken.findUnique({
    where: { provider: X_PROVIDER_KEY },
    select: { accessTokenEnc: true, externalUsername: true },
  });

  const hasSavedRow = Boolean(tokenRow);
  const hasEncryptedAccessToken = Boolean(tokenRow?.accessTokenEnc);
  console.log("[X POST SEND] token row loaded", {
    hasSavedRow,
    hasEncryptedAccessToken,
    hasUsername: Boolean(tokenRow?.externalUsername?.trim()),
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

  const xResponse = await fetch(X_POST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: normalized }),
    cache: "no-store",
  });

  const rawText = await xResponse.text();
  let xBody: {
    data?: { id?: string };
    errors?: Array<{ detail?: string; message?: string; title?: string; code?: number }>;
    title?: string;
    detail?: string;
    status?: number;
  } = {};
  if (rawText.trim()) {
    try {
      xBody = JSON.parse(rawText) as typeof xBody;
    } catch {
      console.error("[X POST SEND] X response not JSON", {
        httpStatus: xResponse.status,
        bodySnippet: truncateForLog(rawText),
      });
    }
  }

  const firstErr = xBody.errors?.[0];
  const sanitizedXReason =
    firstErr?.detail ||
    firstErr?.message ||
    firstErr?.title ||
    xBody.detail ||
    xBody.title ||
    null;

  if (!xResponse.ok) {
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

  console.log("[X POST SEND] X API success", {
    httpStatus: xResponse.status,
    hasPostId: Boolean(xBody?.data?.id),
  });

  return {
    postId: xBody?.data?.id ?? null,
    username: tokenRow.externalUsername ?? null,
  };
}
