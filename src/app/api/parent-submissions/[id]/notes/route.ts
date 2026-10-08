import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { addSubmissionNote } from "@/lib/services/parent-submissions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>("POST /api/parent-submissions/[id]/notes", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), "Only the owner or an academic coordinator can add notes to parent submissions.");
  const submission = await addSubmissionNote((await params).id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, submission }, { status: 201 });
});
