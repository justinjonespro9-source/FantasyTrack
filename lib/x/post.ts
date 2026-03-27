import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

const X_POST_URL = "https://api.twitter.com/2/tweets";
const MAX_X_POST_CHARS = 280;

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

  const tokenRow = await prisma.externalProviderToken.findUnique({
    where: { provider: "x" },
    select: { accessTokenEnc: true, externalUsername: true },
  });
  if (!tokenRow?.accessTokenEnc) {
    throw new XPostError("X is not connected. Connect your account first.", 400);
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(tokenRow.accessTokenEnc);
  } catch {
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
    throw new XPostError(reason, 400);
  }

  return {
    postId: xBody?.data?.id ?? null,
    username: tokenRow.externalUsername ?? null,
  };
}
