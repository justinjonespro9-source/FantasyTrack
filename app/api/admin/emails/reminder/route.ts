import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { sendReminderEmail } from "@/lib/email";

const DEFAULT_SUBJECT = "FantasyTrack contests are live";
const DEFAULT_BODY = `Hey —

FantasyTrack contests are live now, including tonight’s Wild contest, tomorrow’s Wolves contest, and NCAA contests coming Thursday.

Everyone gets $1,000 in free test funds at signup, and the current max wager is $100 per contest in $5 increments.

Get your picks in here:
https://www.fantasytrack.app/dashboard

Thanks for helping test FantasyTrack early.

– The Commish`;

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isObviousInternalOrTest(email: string): boolean {
  if (!email.includes("@")) return true;
  const [, domainRaw] = email.split("@");
  const domain = String(domainRaw ?? "").toLowerCase().trim();
  if (!domain) return true;
  return (
    domain === "localhost" ||
    domain.endsWith(".local") ||
    domain.endsWith(".test") ||
    domain === "fantasytrack.test" ||
    domain === "example.com" ||
    domain === "example.org" ||
    domain === "example.net"
  );
}

export async function POST(req: NextRequest) {
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

  let body: {
    dryRun?: boolean;
    overrideEmail?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dryRun = Boolean(body?.dryRun);
  const overrideEmail = normalizeEmail(body?.overrideEmail);
  const subject = String(body?.subject ?? "").trim() || DEFAULT_SUBJECT;
  const message = String(body?.message ?? "").trim() || DEFAULT_BODY;

  const allUsers = await prisma.user.findMany({
    where: {
      isAdmin: false,
      isSuspended: false,
    },
    select: {
      email: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const recipients = Array.from(
    new Set(
      allUsers
        .map((u) => normalizeEmail(u.email))
        .filter((email) => email && !isObviousInternalOrTest(email))
    )
  );

  const previewRecipients = recipients.slice(0, 50);

  if (dryRun) {
    return NextResponse.json({
      recipientCount: recipients.length,
      recipients,
      sentCount: 0,
      failedCount: 0,
      failedRecipients: [],
    });
  }

  const targetRecipients = overrideEmail ? [overrideEmail] : recipients;
  const failedRecipients: string[] = [];
  let sentCount = 0;

  for (const to of targetRecipients) {
    try {
      await sendReminderEmail({ to, subject, message });
      sentCount += 1;
    } catch {
      failedRecipients.push(to);
    }
  }

  return NextResponse.json({
    recipientCount: recipients.length,
    recipients: previewRecipients,
    sentCount,
    failedCount: failedRecipients.length,
    failedRecipients,
  });
}
