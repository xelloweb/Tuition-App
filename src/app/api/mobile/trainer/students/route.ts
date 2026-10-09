import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-errors";
import { requireMobileUser, requireOwnTrainerProfile } from "@/lib/mobile-auth";
import { getTrainerMyStudents } from "@/lib/services/trainer-portal";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The trainer's own students with class credits per subject, from the same
 * function as the website's trainer dashboard (credits restored by edits and
 * deletions are counted, unlike the old phone-only sum).
 */
export const GET = withErrorHandling("GET /api/mobile/trainer/students", async (req) => {
  const { searchParams } = new URL(req.url);
  // Always the signed-in trainer's own profile, whatever the app asks for.
  const teacherId = requireOwnTrainerProfile(await requireMobileUser(req), searchParams.get("teacherId"));

  const students = await getTrainerMyStudents(teacherId);

  return NextResponse.json({
    success: true,
    students: students.map((st) => ({
      id: st.studentId,
      name: st.studentName,
      studentCode: st.studentCode,
      grade: st.grade,
      board: st.board,
      country: st.country,
      whatsappNumber: st.whatsappNumber,
      assignedSubjects: st.assignedSubjects.map((sub) => ({
        enrolmentId: sub.enrolmentId,
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        subjectColor: sub.subjectColor,
        // "Not set yet" shows as 0, as the phone did before.
        allocatedCredits: sub.allocatedCredits ?? 0,
        consumedCredits: sub.completedClasses,
        remainingCredits: sub.remainingCredits ?? 0,
      })),
      slots: st.assignedSubjects.flatMap((sub) =>
        sub.schedules.map((slot) => ({
          id: slot.slotId,
          weekday: slot.weekday,
          start: formatMinutes(slot.startMinutes),
          end: formatMinutes(slot.endMinutes),
          subjectName: sub.subjectName,
        }))
      ),
    })),
  });
});
