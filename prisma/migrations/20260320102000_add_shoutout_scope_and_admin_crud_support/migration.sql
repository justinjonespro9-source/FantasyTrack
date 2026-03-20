-- Add scope for global vs series Commish Notes.
CREATE TYPE "ShoutoutScope" AS ENUM ('GLOBAL', 'SERIES');

ALTER TABLE "Shoutout"
ADD COLUMN "scope" "ShoutoutScope" NOT NULL DEFAULT 'SERIES';

-- Allow global notes to be unbound from a series.
ALTER TABLE "Shoutout" DROP CONSTRAINT "Shoutout_seriesId_fkey";
ALTER TABLE "Shoutout" ALTER COLUMN "seriesId" DROP NOT NULL;
ALTER TABLE "Shoutout"
ADD CONSTRAINT "Shoutout_seriesId_fkey"
FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

