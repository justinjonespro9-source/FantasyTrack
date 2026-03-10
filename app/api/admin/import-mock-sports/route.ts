import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { importMockSportsData } from "@/lib/sports/import-mock";

export async function POST() {
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

  try {
    await importMockSportsData();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error importing mock sports data", error);
    return NextResponse.json(
      { error: "Unable to import mock sports data." },
      { status: 500 }
    );
  }
}

