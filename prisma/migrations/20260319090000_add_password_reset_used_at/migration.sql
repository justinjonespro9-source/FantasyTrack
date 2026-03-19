-- Add usedAt column to PasswordResetToken for auditability of reset usage.
ALTER TABLE "PasswordResetToken"
ADD COLUMN "usedAt" TIMESTAMP(3);

