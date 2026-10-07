import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { deleteDraft, updateDraft } from "@/lib/services/admission-drafts";

type Ctx = { params: Promise<{ id: string }> };
const DENIED = "Only the owner or an academic coordinator can work on admissions.";

/** Body: { data, baseUpdatedAt } — refused with 409 if someone else saved the draft meanwhile. */
export const PATCH = withErrorHandling<Ctx>("PATCH /api/admission-drafts/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const { id } = await params;
  const draft = await updateDraft(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, draft });
});

export const DELETE = withErrorHandling<Ctx>("DELETE /api/admission-drafts/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const { id } = await params;
  await deleteDraft(id, user);
  return NextResponse.json({ success: true, message: "Draft deleted." });
});
