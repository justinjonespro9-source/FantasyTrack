-- CreateEnum
CREATE TYPE "XPostType" AS ENUM ('LOCK_REMINDER', 'SETTLEMENT_RECAP');

-- CreateEnum
CREATE TYPE "XPostStatus" AS ENUM ('POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "XPostLog" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "postType" "XPostType" NOT NULL,
    "status" "XPostStatus" NOT NULL,
    "postId" TEXT,
    "errorMessage" TEXT,
    "postedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "XPostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XPostLog_postType_createdAt_idx" ON "XPostLog"("postType", "createdAt");

-- CreateIndex
CREATE INDEX "XPostLog_status_createdAt_idx" ON "XPostLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XPostLog_contestId_postType_key" ON "XPostLog"("contestId", "postType");

-- AddForeignKey
ALTER TABLE "XPostLog" ADD CONSTRAINT "XPostLog_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
