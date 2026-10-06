import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { parseAttendanceBody, submitSessionAttendance } from "@/lib/attendance-ledger";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>("POST /api/sessions/[id]/attendance", async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const fields = parseAttendanceBody(await readJsonObject(req));
  const result = await submitSessionAttendance({ sessionId: id, ...fields, user });
  return NextResponse.json(result);
});
