/**
 * Admission drafts: an unfinished admission form saved as JSON. Drafts never
 * create students, guardians or codes. Saving checks the version the editor
 * started from, so one staff member cannot silently overwrite another's changes.
 */
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, notFoundError, validationError } from "../api-errors";
import { formatInTimeZone } from "../timezones";
import { linkDraftInTransaction, readStored } from "./parent-submissions";

const MAX_DRAFT_CHARS = 200_000;

type DraftRow = {
  id: string;
  label: string;
  data: string;
  createdByName: string;
  updatedByName: string;
  createdAt: Date;
  updatedAt: Date;
  parentSubmission?: { id: string; reference: string; submittedData: string } | null;
};

/** Parent's preferred times shown (unconfirmed) on the schedule step. */
export function intakeContext(s: { id: string; reference: string; submittedData: string }) {
  const stored = readStored(s.submittedData);
  return {
    id: s.id,
    reference: s.reference,
    preferences: (stored?.preferences ?? []).map((p) => ({ subjectId: p.subjectId, subjectName: p.subjectName, weekday: p.weekday, start: p.start, end: p.end })),
  };
}
export type IntakeContext = ReturnType<typeof intakeContext>;

export function presentDraft(d: DraftRow) {
  return {
    id: d.id,
    label: d.label,
    data: d.data,
    createdByName: d.createdByName,
    updatedByName: d.updatedByName,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    submission: d.parentSubmission ? intakeContext(d.parentSubmission) : null,
  };
}

const withSubmission = { parentSubmission: { select: { id: true, reference: true, submittedData: true } } } as const;
export type AdmissionDraftItem = ReturnType<typeof presentDraft>;

function readDraftBody(body: Record<string, unknown>) {
  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("The draft could not be read. Refresh the page and try again.");
  }
  const json = JSON.stringify(data);
  if (json.length > MAX_DRAFT_CHARS) throw validationError("This draft is too large to save.");
  const rawName = (data as Record<string, unknown>).name;
  const label = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 120) : "Untitled admission";
  return { json, label };
}

export async function listDrafts() {
  const drafts = await prisma.admissionDraft.findMany({ orderBy: { updatedAt: "desc" }, include: withSubmission });
  return drafts.map(presentDraft);
}

/** Body: { data, submissionId? } — a draft started from a parent submission is linked to it (one draft per submission). */
export async function createDraft(body: Record<string, unknown>, user: CurrentUser) {
  const { json, label } = readDraftBody(body);
  const submissionId = typeof body.submissionId === "string" && body.submissionId ? body.submissionId : null;
  const id = await prisma.$transaction(async (tx) => {
    const draft = await tx.admissionDraft.create({
      data: { label, data: json, createdByName: user.name, updatedByName: user.name },
    });
    if (submissionId) await linkDraftInTransaction(tx, submissionId, draft.id, user);
    await tx.auditLog.create({
      data: { entityType: "ADMISSION_DRAFT", entityId: draft.id, action: "CREATE_ADMISSION_DRAFT", actorRole: user.role, actorName: user.name, details: JSON.stringify({ label, submissionId }) },
    });
    return draft.id;
  });
  return presentDraft(await prisma.admissionDraft.findUniqueOrThrow({ where: { id }, include: withSubmission }));
}

/** Saves over a draft only if nobody else saved it since `baseUpdatedAt`. */
export async function updateDraft(id: string, body: Record<string, unknown>, user: CurrentUser) {
  const { json, label } = readDraftBody(body);
  const base = typeof body.baseUpdatedAt === "string" ? new Date(body.baseUpdatedAt) : null;
  if (!base || Number.isNaN(base.getTime())) throw validationError("Reload the draft and try again.");
  const result = await prisma.admissionDraft.updateMany({
    where: { id, updatedAt: base },
    data: { label, data: json, updatedByName: user.name },
  });
  if (result.count === 0) {
    const current = await prisma.admissionDraft.findUnique({ where: { id } });
    if (!current) throw notFoundError("This draft was already confirmed or deleted.");
    throw new ApiError(
      409,
      "CONFLICT",
      `${current.updatedByName} saved this draft at ${formatInTimeZone(current.updatedAt)} IST after you opened it. Close the form and open the draft again to see their changes.`
    );
  }
  return presentDraft(await prisma.admissionDraft.findUniqueOrThrow({ where: { id }, include: withSubmission }));
}

export async function deleteDraft(id: string, user: CurrentUser) {
  const draft = await prisma.admissionDraft.findUnique({ where: { id } });
  if (!draft) throw notFoundError("This draft was already confirmed or deleted.");
  await prisma.$transaction([
    prisma.admissionDraft.delete({ where: { id } }),
    prisma.auditLog.create({
      data: { entityType: "ADMISSION_DRAFT", entityId: id, action: "DELETE_ADMISSION_DRAFT", actorRole: user.role, actorName: user.name, details: JSON.stringify({ label: draft.label }) },
    }),
  ]);
}
