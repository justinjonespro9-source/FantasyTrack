-- Add safe admin suspension fields (no hard deletes)
ALTER TABLE "User"
ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN "suspendedAt" TIMESTAMP(3);

ALTER TABLE "User"
ADD COLUMN "suspensionReason" TEXT;

