import { NextResponse } from "next/server";
import { canManageStudents, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { createStudent, listStudentsFor, parseStudentFields } from "@/lib/services/students";
import { generateTimetableOccurrences } from "@/lib/services/timetable";

export const GET = withErrorHandling("GET /api/students", async () => {
  const user = await requireUser();
  // Teachers only receive the students they are assigned to.
  const students = await listStudentsFor(user);
  return NextResponse.json({ success: true, students });
});

export const POST = withErrorHandling("POST /api/students", async (req) => {
  const user = await requireUser();
  requirePermission(
    canManageStudents(user.role),
    "Only the owner or an academic coordinator can register students."
  );

  const body = await readJsonObject(req);
  const fields = parseStudentFields(body, { partial: false });
  const { result: student, replayed } = await createStudent(fields, user, readIdempotencyKey(req));

  if (!replayed && student.status !== "DRAFT" && fields.slots && fields.slots.length > 0) {
    try {
      await generateTimetableOccurrences(student.id, user);
    } catch (e) {
      console.error("Failed to generate timetable occurrences during student creation", e);
    }
  }

  return NextResponse.json({ success: true, student, replayed }, { status: replayed ? 200 : 201 });
});
