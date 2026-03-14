-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "lastLiveStatsPullAt" TIMESTAMP(3),
ADD COLUMN     "lastLiveStatsUpdatedCount" INTEGER;
