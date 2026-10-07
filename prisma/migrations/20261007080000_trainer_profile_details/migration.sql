-- Optional trainer profile details (place, qualification, syllabus, devices,
-- availability, WhatsApp, internal notes). Additive only: existing rows keep NULL.
ALTER TABLE "Teacher" ADD COLUMN "location" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "qualification" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "syllabus" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "devices" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "availableDays" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "availableTimes" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "notes" TEXT;
