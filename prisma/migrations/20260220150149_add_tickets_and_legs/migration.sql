-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'SUBMITTED', 'LOCKED', 'SETTLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TicketResult" AS ENUM ('PENDING', 'WON', 'LOST', 'PUSH', 'VOID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "LegResult" AS ENUM ('PENDING', 'WON', 'LOST', 'PUSH', 'VOID');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "ticketId" TEXT,
ADD COLUMN     "ticketLegId" TEXT;

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT,
    "contestId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'SUBMITTED',
    "result" "TicketResult" NOT NULL DEFAULT 'PENDING',
    "stakeAmount" INTEGER NOT NULL,
    "payoutAmount" INTEGER,
    "netAmount" INTEGER,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settlementVer" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketLeg" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "laneNameSnap" TEXT,
    "teamSnap" TEXT,
    "positionSnap" TEXT,
    "oddsTo1Snap" DOUBLE PRECISION,
    "result" "LegResult" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "TicketLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_userId_placedAt_idx" ON "Ticket"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "Ticket_contestId_placedAt_idx" ON "Ticket"("contestId", "placedAt");

-- CreateIndex
CREATE INDEX "Ticket_userId_contestId_idx" ON "Ticket"("userId", "contestId");

-- CreateIndex
CREATE INDEX "Ticket_status_placedAt_idx" ON "Ticket"("status", "placedAt");

-- CreateIndex
CREATE INDEX "TicketLeg_ticketId_idx" ON "TicketLeg"("ticketId");

-- CreateIndex
CREATE INDEX "TicketLeg_userId_contestId_idx" ON "TicketLeg"("userId", "contestId");

-- CreateIndex
CREATE INDEX "TicketLeg_contestId_market_idx" ON "TicketLeg"("contestId", "market");

-- CreateIndex
CREATE INDEX "TicketLeg_laneId_market_idx" ON "TicketLeg"("laneId", "market");

-- CreateIndex
CREATE UNIQUE INDEX "TicketLeg_ticketId_laneId_market_key" ON "TicketLeg"("ticketId", "laneId", "market");

-- CreateIndex
CREATE INDEX "Transaction_ticketId_createdAt_idx" ON "Transaction"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_ticketLegId_createdAt_idx" ON "Transaction"("ticketLegId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLeg" ADD CONSTRAINT "TicketLeg_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLeg" ADD CONSTRAINT "TicketLeg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLeg" ADD CONSTRAINT "TicketLeg_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLeg" ADD CONSTRAINT "TicketLeg_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "Lane"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ticketLegId_fkey" FOREIGN KEY ("ticketLegId") REFERENCES "TicketLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
