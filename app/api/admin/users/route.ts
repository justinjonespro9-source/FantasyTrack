import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type StatusFilter = "all" | "active" | "suspended";
type SortOption = "newest" | "oldest" | "name_asc" | "email_asc";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
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

  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const statusRaw = (params.get("status") ?? "all").trim().toLowerCase();
  const sortRaw = (params.get("sort") ?? "newest").trim().toLowerCase();

  const status: StatusFilter =
    statusRaw === "active" || statusRaw === "suspended" ? (statusRaw as StatusFilter) : "all";
  const sort: SortOption =
    sortRaw === "oldest" || sortRaw === "name_asc" || sortRaw === "email_asc"
      ? (sortRaw as SortOption)
      : "newest";

  const page = parsePositiveInt(params.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status === "active") where.isSuspended = false;
  if (status === "suspended") where.isSuspended = true;

  const orderBy =
    sort === "oldest"
      ? { createdAt: "asc" as const }
      : sort === "name_asc"
        ? { displayName: "asc" as const }
        : sort === "email_asc"
          ? { email: "asc" as const }
          : { createdAt: "desc" as const };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        displayName: true,
        email: true,
        isSuspended: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      suspendedAt: u.suspendedAt ? u.suspendedAt.toISOString() : null,
      suspensionReason: u.suspensionReason ?? null,
    })),
    page,
    pageSize,
    total,
    totalPages,
  });
}

