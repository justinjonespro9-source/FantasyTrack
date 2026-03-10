/*
  Warnings:

  - A unique constraint covering the columns `[ticketLegId,type]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "ContestPost" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isCommish" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContestPost_contestId_createdAt_idx" ON "ContestPost"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "ContestPost_contestId_isPinned_idx" ON "ContestPost"("contestId", "isPinned");

-- CreateIndex
CREATE INDEX "ContestPostLike_postId_idx" ON "ContestPostLike"("postId");

-- CreateIndex
CREATE INDEX "ContestPostLike_userId_idx" ON "ContestPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestPostLike_postId_userId_key" ON "ContestPostLike"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_ticketLegId_type_key" ON "Transaction"("ticketLegId", "type");

-- AddForeignKey
ALTER TABLE "ContestPost" ADD CONSTRAINT "ContestPost_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestPost" ADD CONSTRAINT "ContestPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestPostLike" ADD CONSTRAINT "ContestPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContestPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestPostLike" ADD CONSTRAINT "ContestPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
