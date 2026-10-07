import { NextResponse } from "next/server";
import { canCorrectAttendance, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { declineCorrectionRequest } from "@/lib/services/correction-requests";

type Ctx = { params: Promise<{ id: string }> };

/** Staff decline a trainer's correction request with a note (the attendance stays as it is). */
export const POST = withErrorHandling<Ctx>("POST /api/correction-requests/[id]/decline", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canCorrectAttendance(user.role), "Only the owner or an academic coordinator can decline correction requests.");
  const { id } = await params;
  const request = await declineCorrectionRequest(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, request });
});
