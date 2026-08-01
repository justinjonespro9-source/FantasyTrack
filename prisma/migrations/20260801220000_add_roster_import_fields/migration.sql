-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "contestType" TEXT,
ADD COLUMN     "season" INTEGER,
ADD COLUMN     "week" INTEGER,
ADD COLUMN     "scoringFormat" TEXT,
ADD COLUMN     "slate" TEXT,
ADD COLUMN     "marketMode" TEXT DEFAULT 'PURE_POOL';

-- AlterTable
ALTER TABLE "Lane" ADD COLUMN     "opponent" TEXT,
ADD COLUMN     "depthRole" TEXT,
ADD COLUMN     "seedRank" INTEGER,
ADD COLUMN     "projectedPoints" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "displayOrder" INTEGER,
ADD COLUMN     "openingPoolWeight" DOUBLE PRECISION,
ADD COLUMN     "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "ContestImportBatch" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "importedByUserId" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedMetadata" JSONB,
    "normalizedPayload" JSONB,
    "sourceLabel" TEXT NOT NULL DEFAULT 'AI_STRUCTURED_IMPORT',
    "parserVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "parsedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContestImportBatch_contestId_createdAt_idx" ON "ContestImportBatch"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "ContestImportBatch_importedByUserId_idx" ON "ContestImportBatch"("importedByUserId");

-- CreateIndex
CREATE INDEX "Lane_importBatchId_idx" ON "Lane"("importBatchId");

-- CreateIndex
CREATE INDEX "Lane_contestId_displayOrder_idx" ON "Lane"("contestId", "displayOrder");

-- AddForeignKey
ALTER TABLE "ContestImportBatch" ADD CONSTRAINT "ContestImportBatch_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestImportBatch" ADD CONSTRAINT "ContestImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lane" ADD CONSTRAINT "Lane_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ContestImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
