import { NextResponse } from "next/server";
import { canScheduleSessions, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { generateTimetableOccurrences, getTimetableView, presentPlan } from "@/lib/services/timetable";

type Ctx = { params: Promise<{ id: string }> };

/** Books any missing classes from the weekly timetable for the next 4 weeks. Safe to repeat. */
export const POST = withErrorHandling<Ctx>("POST /api/students/[id]/timetable/generate", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(
    canScheduleSessions(user.role),
    "Only the owner or an academic coordinator can book timetable classes."
  );

  const { id } = await params;
  const result = presentPlan(await generateTimetableOccurrences(id, user));
  return NextResponse.json({
    success: true,
    result,
    timetable: await getTimetableView(id),
    message: result.toBook.length
      ? `${result.toBook.length} class(es) booked from the weekly timetable.`
      : "No new classes needed — the next 4 weeks are already booked or blocked (see issues).",
  });
});
