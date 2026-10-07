import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { checkAdmission, createStudent, listStudentsFor, parseStudentFields } from "@/lib/services/students";

export const GET = withErrorHandling("GET /api/students", async () => {
  const user = await requireUser();
  // Teachers only receive the students they are assigned to.
  const students = await listStudentsFor(user);
  return NextResponse.json({ success: true, students });
});

/**
 * Confirms an admission: student, guardian, enrolments, optional package,
 * weekly slots and the first four weeks of bookings, all in one transaction.
 * With { checkOnly: true } every check runs and nothing is saved.
 */
export const POST = withErrorHandling("POST /api/students", async (req) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can register students."
  );

  const body = await readJsonObject(req);
  const fields = parseStudentFields(body, { partial: false });
  if (body.checkOnly === true) {
    const { booking } = await checkAdmission(fields, user);
    return NextResponse.json({ success: true, checkOnly: true, booking });
  }
  const { result: student, replayed, booking } = await createStudent(fields, user, readIdempotencyKey(req));
  return NextResponse.json({ success: true, student, replayed, booking }, { status: replayed ? 200 : 201 });
});
