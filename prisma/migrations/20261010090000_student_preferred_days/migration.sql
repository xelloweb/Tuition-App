-- Preferred class days on the student (JSON list of weekdays, 0 = Sunday).
-- Additive only: existing students keep NULL and their timing note.
ALTER TABLE "Student" ADD COLUMN "preferredDays" TEXT;
