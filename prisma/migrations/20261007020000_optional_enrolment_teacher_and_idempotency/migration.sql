-- 1. IdempotencyKey: lets a retried create request return the record it already
--    created instead of inserting a duplicate.
-- 2. SubjectEnrollment.teacherId becomes optional (students can be enrolled
--    before a trainer is assigned) and ON DELETE changes CASCADE -> SET NULL so
--    removing a trainer can no longer delete enrolments.
--    SQLite cannot alter a column in place, so the table is rebuilt; every row
--    is copied across unchanged. No backfill required.

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubjectEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "targetExamDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubjectEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectEnrollment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SubjectEnrollment" ("createdAt", "id", "notes", "status", "studentId", "subjectId", "targetExamDate", "teacherId", "updatedAt") SELECT "createdAt", "id", "notes", "status", "studentId", "subjectId", "targetExamDate", "teacherId", "updatedAt" FROM "SubjectEnrollment";
DROP TABLE "SubjectEnrollment";
ALTER TABLE "new_SubjectEnrollment" RENAME TO "SubjectEnrollment";
CREATE UNIQUE INDEX "SubjectEnrollment_studentId_subjectId_key" ON "SubjectEnrollment"("studentId", "subjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

