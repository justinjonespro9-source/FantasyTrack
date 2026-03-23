import { prisma } from "@/lib/prisma";

export async function canUserAccessSeriesById({
  seriesId,
  userId,
  isAdmin,
}: {
  seriesId: string;
  userId?: string | null;
  isAdmin?: boolean;
}): Promise<{ exists: boolean; canAccess: boolean; isPrivate: boolean }> {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { id: true, isPrivate: true },
  });

  if (!series) {
    return { exists: false, canAccess: false, isPrivate: false };
  }

  if (!series.isPrivate || isAdmin) {
    return { exists: true, canAccess: true, isPrivate: Boolean(series.isPrivate) };
  }

  if (!userId) {
    return { exists: true, canAccess: false, isPrivate: true };
  }

  const membership = await prisma.seriesMembership.findUnique({
    where: {
      seriesId_userId: {
        seriesId,
        userId,
      },
    },
    select: { id: true },
  });

  return {
    exists: true,
    canAccess: Boolean(membership),
    isPrivate: true,
  };
}
