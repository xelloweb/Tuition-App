import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { createDraft, listDrafts } from "@/lib/services/admission-drafts";

const DENIED = "Only the owner or an academic coordinator can work on admissions.";

export const GET = withErrorHandling("GET /api/admission-drafts", async () => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  return NextResponse.json({ success: true, drafts: await listDrafts() });
});

export const POST = withErrorHandling("POST /api/admission-drafts", async (req) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const draft = await createDraft(await readJsonObject(req), user);
  return NextResponse.json({ success: true, draft }, { status: 201 });
});
