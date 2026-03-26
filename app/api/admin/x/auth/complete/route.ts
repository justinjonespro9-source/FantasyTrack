import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

/**
 * Minimal success response for debugging OAuth redirects (optional alternative to /admin/x-oauth-done).
 * To use: point success redirect in callback to this path instead of /admin/x-oauth-done.
 */
export async function GET() {
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

  console.log("[x/oauth/complete] json_ok");
  return NextResponse.json({ ok: true, message: "X OAuth success (tokens already stored by callback)." });
}
