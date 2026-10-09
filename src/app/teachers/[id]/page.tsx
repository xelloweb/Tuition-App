import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, canManageTeachers } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrainerSchedule } from "@/lib/services/trainer-schedule";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrainerWeekView } from "@/components/teachers/TrainerWeekView";
import { DAY_NAMES, rangeLabel } from "@/lib/trainer-week";
import { formatInTimeZone } from "@/lib/timezones";

export const dynamic = "force-dynamic";

/** One trainer's students and Monday–Sunday timetable, read live from allocations and the weekly timetable. */
export default async function TrainerSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const ownProfile = user.role === "TEACHER" && user.teacherId === id;
  if (!canManageTeachers(user.role) && !ownProfile) {
    return <AccessDenied message="Trainer timetables are available to the owner, coordinators and the trainer." />;
  }
  if (!(await prisma.teacher.findUnique({ where: { id }, select: { id: true } }))) {
    return <AccessDenied message="This trainer no longer exists." />;
  }

  const schedule = await getTrainerSchedule(id);
  const { trainer, totals } = schedule;
  const hours = Math.round((totals.weeklyMinutes / 60) * 10) / 10;

  return (
    <div className="space-y-6">
      <Link
        href="/teachers"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Trainers
      </Link>

      <PageHeader
        context={`Trainer timetable · IST${trainer.active ? "" : " · inactive"}`}
        title={trainer.name}
        description={
          <>
            {trainer.subjects}
            {(trainer.availableDays || trainer.availableTimes) && (
              <>
                {" "}
                · Stated availability: {[trainer.availableDays, trainer.availableTimes].filter(Boolean).join(", ")}
              </>
            )}
          </>
        }
      />

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "Students", value: totals.students },
          { label: "Classes a week", value: totals.weeklyClasses },
          { label: "Hours a week", value: hours },
        ].map((m) => (
          <div key={m.label} className="rounded-card border border-line bg-surface p-3 sm:p-4">
            <dt className="text-xs font-semibold text-ink-subtle sm:text-sm">{m.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="week-heading" className="space-y-3">
        <div>
          <h2 id="week-heading" className="text-lg font-bold text-ink">Weekly timetable</h2>
          <p className="text-sm text-ink-muted">
            Monday to Sunday from the weekly timetable. Free times are gaps between classes from 6:00 AM to 11:00 PM.
          </p>
        </div>
        <TrainerWeekView week={schedule.week} />
      </section>

      {schedule.extraClasses.length > 0 && (
        <section aria-labelledby="extra-heading" className="space-y-2">
          <h2 id="extra-heading" className="text-lg font-bold text-ink">Extra classes in the next 7 days</h2>
          <p className="text-sm text-ink-muted">One-off or moved classes that are not part of the weekly pattern.</p>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {schedule.extraClasses.map((x) => (
              <li key={x.sessionId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm">
                <span className="font-semibold tabular-nums text-ink">{formatInTimeZone(x.start, "Asia/Kolkata")}</span>
                <span className="text-ink-muted">
                  {x.studentName} · {x.subjectName}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="students-heading" className="space-y-3">
        <h2 id="students-heading" className="text-lg font-bold text-ink">Students ({schedule.students.length})</h2>
        {schedule.students.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-4 text-sm text-ink-muted">No students are allocated to this trainer yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {schedule.students.map((st) => (
              <li key={st.studentId} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/students/${st.studentId}`} className="inline-flex min-h-[44px] items-center font-bold text-ink hover:text-brand-text hover:underline">
                    {st.studentName}
                  </Link>
                  <span className="text-xs text-ink-subtle">
                    {st.studentCode} · {st.grade}
                    {st.status !== "ACTIVE" && ` · ${st.status.toLowerCase()}`}
                  </span>
                </div>
                <ul className="mt-2 space-y-2">
                  {st.subjects.map((sub) => (
                    <li key={sub.subjectName} className="text-sm">
                      <span className="font-semibold text-ink">{sub.subjectName}</span>
                      <span className="block text-ink-muted">
                        {sub.slots.length
                          ? sub.slots.map((sl) => `${DAY_NAMES[sl.weekday]} ${rangeLabel(sl.startMinutes, sl.endMinutes)}`).join(" · ")
                          : "No weekly class time set yet"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
