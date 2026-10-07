-- Captures schema changes made with `prisma db push` (login + draft admissions):
-- User password hash / invitation token / expiry, and Student.draftData.
-- All columns are nullable; the unique index ignores NULLs. No backfill needed.


-- AlterTable
ALTER TABLE "Student" ADD COLUMN "draftData" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "inviteExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");

