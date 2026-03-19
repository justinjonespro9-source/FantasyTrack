import { randomBytes, createHash } from "crypto";

export function generatePasswordResetToken(): { token: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { token: rawToken, tokenHash };
}

