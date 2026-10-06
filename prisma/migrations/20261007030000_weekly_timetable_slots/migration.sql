-- Weekly timetable: recurring slots per subject enrolment (one-to-many).
-- * TimetableSlot stores weekday + local start/end minutes + IANA time zone,
--   effective period, active flag and actor. No slot-per-enrolment limit.
-- * Session gains timetableSlotId + occurrenceDate linking generated classes to
--   their slot; the unique pair makes regeneration idempotent. Both columns are
--   nullable, so every existing (one-off) session is copied unchanged.
-- No backfill: existing one-off classes are not converted into recurrences.

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrolmentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "timeZone" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveUntil" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "previousSlotId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "updatedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableSlot_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "SubjectEnrollment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "scheduledStartTimeUtc" DATETIME NOT NULL,
    "scheduledEndTimeUtc" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "meetingUrl" TEXT,
    "recurrenceId" TEXT,
    "timetableSlotId" TEXT,
    "occurrenceDate" TEXT,
    "rescheduledFromId" TEXT,
    "rescheduledToId" TEXT,
    "isCreditReserved" BOOLEAN NOT NULL DEFAULT true,
    "isCreditConsumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "StudentPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "durationMinutes", "id", "isCreditConsumed", "isCreditReserved", "meetingUrl", "packageId", "recurrenceId", "rescheduledFromId", "rescheduledToId", "scheduledEndTimeUtc", "scheduledStartTimeUtc", "status", "studentId", "subjectId", "teacherId", "updatedAt") SELECT "createdAt", "durationMinutes", "id", "isCreditConsumed", "isCreditReserved", "meetingUrl", "packageId", "recurrenceId", "rescheduledFromId", "rescheduledToId", "scheduledEndTimeUtc", "scheduledStartTimeUtc", "status", "studentId", "subjectId", "teacherId", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_timetableSlotId_occurrenceDate_key" ON "Session"("timetableSlotId", "occurrenceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TimetableSlot_enrolmentId_idx" ON "TimetableSlot"("enrolmentId");

-- CreateIndex
CREATE INDEX "TimetableSlot_teacherId_idx" ON "TimetableSlot"("teacherId");

