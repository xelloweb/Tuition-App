import { NextResponse } from "next/server";
import { canManageTeachers, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { getTrainerSchedule } from "@/lib/services/trainer-schedule";

type Ctx = { params: Promise<{ id: string }> };

/**
 * A trainer's week (Monday–Sunday, IST), students and free time. Owner and
 * coordinators see any trainer; a trainer sees their own. `exclude=<studentId>`
 * leaves out the student being edited, so their own current slots are not
 * reported as clashes with themselves.
 */
export const GET = withErrorHandling<Ctx>("GET /api/teachers/[id]/schedule", async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const ownProfile = user.role === "TEACHER" && user.teacherId === id;
  requirePermission(canManageTeachers(user.role) || ownProfile, "Only the owner, a coordinator or the trainer can see this timetable.");

  const exclude = new URL(req.url).searchParams.get("exclude")?.trim() || undefined;
  const schedule = await getTrainerSchedule(id, { excludeStudentId: canManageTeachers(user.role) ? exclude : undefined });
  return NextResponse.json(schedule);
});
