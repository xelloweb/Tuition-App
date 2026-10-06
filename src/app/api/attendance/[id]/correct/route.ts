import { NextResponse } from "next/server";
import { canCorrectAttendance, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { correctAttendanceRecord } from "@/lib/attendance-ledger";
import { SessionOutcome, StudentAttendance } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>("POST /api/attendance/[id]/correct", async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  requirePermission(canCorrectAttendance(user.role), "Only the owner or an academic coordinator can correct attendance.");

  const body = await readJsonObject(req);
  const result = await correctAttendanceRecord(
    id,
    String(body.newOutcome ?? "") as SessionOutcome,
    String(body.newAttendance ?? "") as StudentAttendance,
    typeof body.reason === "string" ? body.reason : "",
    user
  );
  return NextResponse.json({ success: true, result, warnings: result.warnings });
});
