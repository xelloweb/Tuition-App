import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { editManualAttendance, deleteManualAttendance } from "@/lib/services/manual-attendance";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>("PATCH /api/attendance/[id]", async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const body = await readJsonObject(req);

  const durationMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : undefined;
  const classDate = body.classDate ? String(body.classDate) : undefined;
  const topicCovered = typeof body.topicCovered === "string" ? body.topicCovered : undefined;
  const homework = typeof body.homework === "string" ? body.homework : undefined;
  const studentProgressNote = typeof body.studentProgressNote === "string" ? body.studentProgressNote : undefined;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  const result = await editManualAttendance(
    {
      attendanceId: id,
      durationMinutes,
      classDate,
      topicCovered,
      homework,
      studentProgressNote,
      reason,
    },
    user
  );

  return NextResponse.json(result);
});

export const DELETE = withErrorHandling<Ctx>("DELETE /api/attendance/[id]", async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();

  const result = await deleteManualAttendance(id, user);

  return NextResponse.json(result);
});
