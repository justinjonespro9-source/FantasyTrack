-- CreateEnum
CREATE TYPE "LaneStatus" AS ENUM ('ACTIVE', 'QUESTIONABLE', 'DOUBTFUL', 'SCRATCHED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'VOID_REFUND';

-- AlterTable
ALTER TABLE "Lane" ADD COLUMN     "status" "LaneStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TicketLeg" ADD COLUMN     "isVoided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);
