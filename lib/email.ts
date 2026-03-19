import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Public app URL used for links in emails, e.g. https://app.fantasytrack.app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(opts: {
  to: string;
  email: string;
  selector: string;
  token: string;
}): Promise<void> {
  const resetUrl = getResetUrl(opts.email, opts.selector, opts.token);

  if (!resend || !RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[email] RESEND_API_KEY not set. Password reset email not sent. Reset link:",
        resetUrl
      );
      return;
    }
    throw new Error(
      "RESEND_API_KEY is not configured. Password reset emails cannot be sent."
    );
  }

  await resend.emails.send({
    from: "FantasyTrack <no-reply@auth.fantasytrack.app>",
    to: opts.to,
    subject: "Reset your FantasyTrack password",
    text: [
      "You requested a link to reset your FantasyTrack password.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
  });
}

function getResetUrl(email: string, selector: string, token: string): string {
  const url = new URL("/reset-password", APP_URL);
  url.searchParams.set("selector", selector);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

/**
 * Environment requirements for email:
 * - RESEND_API_KEY: API key for Resend
 * - NEXT_PUBLIC_APP_URL: Public base URL for the app (e.g. https://app.fantasytrack.app)
 */
