import { NextResponse } from "next/server";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { parseAttendanceBody, submitSessionAttendance } from "@/lib/attendance-ledger";
import { requireMobileUser } from "@/lib/mobile-auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * A trainer marks one of their classes from the phone. Same code and rules as
 * the website's POST /api/sessions/[id]/attendance (only the trainer of the
 * class, credits through the ledger, no double marking); only the sign-in differs.
 */
export const POST = withErrorHandling<Ctx>("POST /api/mobile/trainer/sessions/[id]/attendance", async (req, { params }) => {
  const { id } = await params;
  const user = await requireMobileUser(req);
  const fields = parseAttendanceBody(await readJsonObject(req));
  const result = await submitSessionAttendance({ sessionId: id, ...fields, user });
  return NextResponse.json(result);
});
