import { NextResponse } from "next/server";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { requireMobileUser } from "@/lib/mobile-auth";
import { parseManualAttendanceBody, recordManualAttendance } from "@/lib/services/manual-attendance";

/**
 * A trainer records a class for one of their students and subjects from the
 * phone. Same code as the website's POST /api/attendance: only their own
 * students and subjects, credits by length, duplicate and over-package checks.
 */
export const POST = withErrorHandling("POST /api/mobile/trainer/attendance", async (req) => {
  const user = await requireMobileUser(req);
  const result = await recordManualAttendance(parseManualAttendanceBody(await readJsonObject(req)), user);
  return NextResponse.json(result);
});
