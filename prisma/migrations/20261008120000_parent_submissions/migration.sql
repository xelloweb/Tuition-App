-- CreateTable
CREATE TABLE "ParentSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "submittedData" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "subjectNames" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "whatsappKey" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "assignedToName" TEXT,
    "followUpOn" TEXT,
    "seenAt" DATETIME,
    "admissionDraftId" TEXT,
    "convertedStudentId" TEXT,
    "convertedAt" DATETIME,
    "convertedByName" TEXT,
    "linkedStudentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParentSubmission_admissionDraftId_fkey" FOREIGN KEY ("admissionDraftId") REFERENCES "AdmissionDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParentSubmission_convertedStudentId_fkey" FOREIGN KEY ("convertedStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParentSubmission_linkedStudentId_fkey" FOREIGN KEY ("linkedStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentSubmissionNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentSubmissionNote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ParentSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentSubmission_reference_key" ON "ParentSubmission"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSubmission_submissionKey_key" ON "ParentSubmission"("submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSubmission_admissionDraftId_key" ON "ParentSubmission"("admissionDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSubmission_convertedStudentId_key" ON "ParentSubmission"("convertedStudentId");

-- CreateIndex
CREATE INDEX "ParentSubmission_status_idx" ON "ParentSubmission"("status");

-- CreateIndex
CREATE INDEX "ParentSubmission_whatsappKey_idx" ON "ParentSubmission"("whatsappKey");

-- CreateIndex
CREATE INDEX "ParentSubmission_createdAt_idx" ON "ParentSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "ParentSubmissionNote_submissionId_idx" ON "ParentSubmissionNote"("submissionId");

