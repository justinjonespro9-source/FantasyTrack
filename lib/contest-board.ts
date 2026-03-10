"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { hasEnteredContest } from "@/lib/entry";

const MAX_POST_LEN = 1000;

function assertBody(input: string): string {
  const body = String(input ?? "").trim();
  if (!body) throw new Error("Post cannot be empty.");
  if (body.length > MAX_POST_LEN) throw new Error(`Post too long (max ${MAX_POST_LEN} chars).`);
  return body;
}

// ✅ NEW: safe session getter (no throw)
async function getSessionOrNull() {
  const session = await getCurrentSession();
  return session?.user?.id ? session : null;
}

// Keep this for actions that truly require auth
async function requireSessionUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) throw new Error("Unauthorized.");
  return session;
}

async function requireAdminUser(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) throw new Error("Forbidden.");
  return true;
}

export async function getContestPosts(contestId: string) {
  // ✅ allow read for logged-out users
  const session = await getSessionOrNull();
  const userId = session?.user?.id ?? null;

  let isAdmin = false;
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    isAdmin = !!dbUser?.isAdmin;
  }

  return prisma.contestPost.findMany({
    where: {
      contestId,
      ...(isAdmin ? {} : { isHidden: false }),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, displayName: true } },
      likes: { select: { id: true, userId: true } },
    },
  });
}

export async function createContestPost(opts: {
  contestId: string;
  body: string;
  asCommish?: boolean;
  pathToRevalidate?: string;
}) {
  const session = await requireSessionUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  const isAdmin = !!dbUser?.isAdmin;

  // ✅ server-side gate: must be entered unless admin
  if (!isAdmin) {
    const entered = await hasEnteredContest(opts.contestId, session.user.id);
    if (!entered) {
      throw new Error("You must enter this contest (100 pts) to post.");
    }
  }

  await prisma.contestPost.create({
    data: {
      contestId: opts.contestId,
      userId: session.user.id,
      body: assertBody(opts.body),
      // Only admins can create OFFICIAL posts
      isCommish: Boolean(opts.asCommish && isAdmin),
    },
  });

  if (opts.pathToRevalidate) revalidatePath(opts.pathToRevalidate);
}

export async function setPostPinned(opts: {
  postId: string;
  pinned: boolean;
  pathToRevalidate?: string;
}) {
  const session = await requireSessionUser();
  await requireAdminUser(session.user.id);

  await prisma.contestPost.update({
    where: { id: opts.postId },
    data: { isPinned: opts.pinned },
  });

  if (opts.pathToRevalidate) revalidatePath(opts.pathToRevalidate);
}

export async function setPostHidden(opts: {
  postId: string;
  hidden: boolean;
  pathToRevalidate?: string;
}) {
  const session = await requireSessionUser();
  await requireAdminUser(session.user.id);

  await prisma.contestPost.update({
    where: { id: opts.postId },
    data: { isHidden: opts.hidden },
  });

  if (opts.pathToRevalidate) revalidatePath(opts.pathToRevalidate);
}

export async function editContestPost(opts: {
  postId: string;
  body: string;
  pathToRevalidate?: string;
}) {
  const session = await requireSessionUser();
  await requireAdminUser(session.user.id);

  await prisma.contestPost.update({
    where: { id: opts.postId },
    data: { body: assertBody(opts.body) },
  });

  if (opts.pathToRevalidate) revalidatePath(opts.pathToRevalidate);
}

export async function deleteContestPost(opts: {
  postId: string;
  pathToRevalidate?: string;
}) {
  const session = await requireSessionUser();
  await requireAdminUser(session.user.id);

  // Soft delete: hide + replace body
  await prisma.contestPost.update({
    where: { id: opts.postId },
    data: {
      isHidden: true,
      body: "[Removed by Official]",
    },
  });

  if (opts.pathToRevalidate) revalidatePath(opts.pathToRevalidate);
}