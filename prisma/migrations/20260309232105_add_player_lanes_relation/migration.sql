/*
  Warnings:

  - A unique constraint covering the columns `[externalProvider,externalId]` on the table `Contest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inviteCode]` on the table `Series` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "awayTeamId" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "homeTeamId" TEXT;

-- AlterTable
ALTER TABLE "Lane" ADD COLUMN     "playerId" TEXT;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "description" TEXT,
ADD COLUMN     "inviteCode" TEXT;

-- CreateTable
CREATE TABLE "SeriesMembership" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT,
    "abbreviation" TEXT,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "jerseyNumber" INTEGER,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "likes" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "ideas" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeriesMembership_userId_idx" ON "SeriesMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeriesMembership_seriesId_userId_key" ON "SeriesMembership"("seriesId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");

-- CreateIndex
CREATE UNIQUE INDEX "League_externalProvider_externalId_key" ON "League"("externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalProvider_externalId_key" ON "Team"("externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalProvider_externalId_key" ON "Player"("externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "Contest_homeTeamId_idx" ON "Contest"("homeTeamId");

-- CreateIndex
CREATE INDEX "Contest_awayTeamId_idx" ON "Contest"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_externalProvider_externalId_key" ON "Contest"("externalProvider", "externalId");

-- CreateIndex
CREATE INDEX "Lane_contestId_playerId_idx" ON "Lane"("contestId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Series_inviteCode_key" ON "Series"("inviteCode");

-- AddForeignKey
ALTER TABLE "SeriesMembership" ADD CONSTRAINT "SeriesMembership_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesMembership" ADD CONSTRAINT "SeriesMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lane" ADD CONSTRAINT "Lane_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
