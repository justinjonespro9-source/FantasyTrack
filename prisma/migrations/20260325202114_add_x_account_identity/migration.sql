-- AlterTable
ALTER TABLE "ExternalProviderToken" ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "externalDisplayName" TEXT,
ADD COLUMN     "externalUsername" TEXT;
