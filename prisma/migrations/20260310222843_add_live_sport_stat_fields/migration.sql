-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "trackConditions" TEXT;

-- AlterTable
ALTER TABLE "Lane" ADD COLUMN     "basketballAssists" INTEGER,
ADD COLUMN     "basketballBlocks" INTEGER,
ADD COLUMN     "basketballPoints" INTEGER,
ADD COLUMN     "basketballRebounds" INTEGER,
ADD COLUMN     "basketballSteals" INTEGER,
ADD COLUMN     "basketballThreesMade" INTEGER,
ADD COLUMN     "basketballTurnovers" INTEGER,
ADD COLUMN     "hockeyAssists" INTEGER,
ADD COLUMN     "hockeyBlocks" INTEGER,
ADD COLUMN     "hockeyGoals" INTEGER,
ADD COLUMN     "hockeySaves" INTEGER,
ADD COLUMN     "hockeyShotsOnGoal" INTEGER,
ADD COLUMN     "soccerAssists" INTEGER,
ADD COLUMN     "soccerGoals" INTEGER,
ADD COLUMN     "soccerSaves" INTEGER,
ADD COLUMN     "soccerShotsOnTarget" INTEGER;
