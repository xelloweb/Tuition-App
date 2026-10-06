import { NextResponse } from "next/server";
import { canScheduleSessions, canViewStudent, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { getTimetableView, presentPlan, previewTimetableChange, saveTimetable } from "@/lib/services/timetable";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>("GET /api/students/[id]/timetable", async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  requirePermission(await canViewStudent(user, id), "You do not have access to this student's timetable.");
  return NextResponse.json({ success: true, timetable: await getTimetableView(id) });
});

/**
 * Body: { timeZone, slots: [{ id?, enrolmentId, teacherId?, weekday, start: "HH:MM", end: "HH:MM" }], previewOnly? }
 * `slots` is the complete desired weekly timetable; slots left out are removed
 * (deactivated when they have class history). Changes apply to future classes only.
 */
export const POST = withErrorHandling<Ctx>("POST /api/students/[id]/timetable", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canScheduleSessions(user.role),
    "Only the owner or an academic coordinator can change timetables."
  );

  const { id } = await params;
  const body = await readJsonObject(req);
  const input = { timeZone: body.timeZone, slots: body.slots };

  if (body.previewOnly === true) {
    const plan = await previewTimetableChange(id, input);
    return NextResponse.json({ success: true, preview: presentPlan(plan) });
  }

  const plan = await saveTimetable(id, input, user);
  const result = presentPlan(plan);
  return NextResponse.json({
    success: true,
    result,
    timetable: await getTimetableView(id),
    message:
      `Timetable saved: ${result.summary.added} added, ${result.summary.edited} edited, ${result.summary.removed} removed. ` +
      `${result.toBook.length} class(es) booked for the next 4 weeks` +
      (result.summary.released ? `, ${result.summary.released} future class(es) released.` : "."),
  });
});
