import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { notFoundError, readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { getSubmissionDetail, updateSubmission } from "@/lib/services/parent-submissions";

type Ctx = { params: Promise<{ id: string }> };
const DENIED = "Only the owner or an academic coordinator can see parent submissions.";

export const GET = withErrorHandling<Ctx>("GET /api/parent-submissions/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const submission = await getSubmissionDetail((await params).id);
  if (!submission) throw notFoundError("This submission no longer exists.");
  return NextResponse.json({ success: true, submission });
});

/** Body: any of { status, assignedToUserId, followUpOn, linkedStudentId }. Converted is never set here. */
export const PATCH = withErrorHandling<Ctx>("PATCH /api/parent-submissions/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageStudents(user.role), DENIED);
  const submission = await updateSubmission((await params).id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, submission });
});
