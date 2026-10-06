-- Brings migration history in line with schema.prisma. Both columns were added
-- to the schema (and to local databases via `prisma db push`) without a
-- migration, so databases created with `prisma migrate deploy` lacked them.
-- Additive and nullable: existing rows are untouched, no backfill required.

-- AlterTable
ALTER TABLE "AttendanceRevision" ADD COLUMN "sessionId" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "gradeRates" TEXT;
