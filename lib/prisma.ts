import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Shared Prisma client for the Next.js app (pages, routes, server actions, libs).
 * Cached on globalThis in development to avoid exhausting the DB connection pool
 * across hot reloads. Production serverless still needs a small connection_limit
 * (or an external pooler) because each instance gets its own client.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
