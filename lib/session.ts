import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentSession() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return session;

  // Block suspended users from using the app at the shared session boundary.
  const dbUser = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { isSuspended: true },
  });

  if (dbUser?.isSuspended) return null;

  return session;
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }
  return user;
}
