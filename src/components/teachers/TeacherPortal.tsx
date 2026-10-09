"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Clock,
  GraduationCap,
  Users,
  CheckCircle2,
  Calendar,
  Wallet,
} from "lucide-react";
import { formatDateOnly, formatTimeOnly } from "@/lib/timezones";
import { addDaysToLocalDate } from "@/lib/zoned-time";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { MarkAttendanceModal } from "@/components/attendance/MarkAttendanceModal";

export interface TeacherPortalStudent {
  id: string;
  name: string;
  grade: string;
  whatsappNumber: string | null;
  assignedSubjects: { id: string; name: string }[];
}

export interface WorkingHoursSummary {
  totalHours: number;
  totalClasses: number;
}

interface PortalSession {
  id: string;
  student: { name: string; grade: string; whatsappNumber: string | null };
  subject: { name: string };
  scheduledStartTimeUtc: Date | string;
  scheduledEndTimeUtc: Date | string;
  status: string;
  attendance?: { sessionOutcome: string; studentAttendance: string } | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  STUDENT_NO_SHOW: "Student absent",
  TEACHER_NO_SHOW: "Trainer absent",
  CANCELLED: "Cancelled",
};

/** Trainer workspace: view confirmed working hours, assigned students, simple attendance marking, and scheduled timetable. */
export function TeacherPortal({
  teacherName,
  teacherId,
  sessions,
  currentDate,
  todayDate,
  pendingCount,
  myStudents = [],
  workingHoursSummary = { totalHours: 0, totalClasses: 0 },
}: {
  teacherName: string;
  teacherId?: string;
  sessions: PortalSession[];
  currentDate: string;
  todayDate: string;
  pendingCount: number;
  myStudents?: any[];
  workingHoursSummary?: WorkingHoursSummary;
}) {
  const router = useRouter();
  const go = (date: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) router.push(date === todayDate ? "/" : `/?date=${date}`);
  };
  const dateLabel = formatDateOnly(`${currentDate}T12:00:00+05:30`);
  const isToday = currentDate === todayDate;
  const [now] = useState(() => Date.now());

  // Modal state for manual attendance
  const [markingSubject, setMarkingSubject] = useState<{
    student: { id: string; name: string; grade?: string };
    subject: { id: string; name: string };
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAttendanceSuccess = (msg: string) => {
    setFeedback(msg);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Trainer Dashboard"
        context={`${teacherName} · times in IST`}
        description="Mark attendance for your assigned students, track confirmed working hours, and view class schedule."
      />

      {feedback && (
        <Notice tone="info" title="Success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Notice>
      )}

      {pendingCount > 0 && (
        <Notice
          tone="warning"
          title={`${pendingCount} scheduled class${pendingCount === 1 ? "" : "es"} past start time`}
        >
          <Link href="/attendance" className="inline-flex items-center min-h-[44px] font-semibold underline">
            Open attendance overview
          </Link>
        </Notice>
      )}

      {/* Trainer Metrics: Confirmed Working Hours & Classes */}
      <section aria-labelledby="working-hours-heading">
        <h2 id="working-hours-heading" className="sr-only">
          Working Hours and Stats
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-slate-900 to-slate-900 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                  Total Working Hours
                </span>
                <Clock className="h-4 w-4 text-teal-400" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white tabular-nums">
                  {workingHoursSummary.totalHours}
                </span>
                <span className="text-sm font-semibold text-slate-300">Hours</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-teal-200/80">
              Updated automatically from confirmed attendance
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Completed Classes
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white tabular-nums">
                  {workingHoursSummary.totalClasses}
                </span>
                <span className="text-sm font-semibold text-slate-400">Classes</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Confirmed attendance submissions
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Payouts & Salary
                </span>
                <Wallet className="h-4 w-4 text-purple-400" aria-hidden="true" />
              </div>
              <div className="mt-2">
                <Link
                  href="/payouts"
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-teal-300 hover:text-teal-200 hover:underline"
                >
                  View Earnings & Payouts →
                </Link>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Standard-specific hourly pay rates applied
            </p>
          </div>
        </div>
      </section>

      {/* "My Students" Section with Quick Attendance Marking */}
      <section
        aria-labelledby="my-students-heading"
        className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 sm:p-6 shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-400" aria-hidden="true" />
            <h2 id="my-students-heading" className="text-lg font-bold text-white">
              My Students ({myStudents.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Assigned subjects, scheduled class timings, and package credits
          </span>
        </div>

        {myStudents.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No active students currently assigned to you.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myStudents.map((stud: any) => {
              const studentId = stud.studentId || stud.id;
              const studentName = stud.studentName || stud.name;

              return (
                <div
                  key={studentId}
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-colors hover:border-slate-700 space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/students/${studentId}`}
                          className="inline-flex min-h-[44px] items-center font-bold text-white text-base break-words hover:text-teal-300 hover:underline transition-colors"
                        >
                          {studentName}
                        </Link>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{stud.grade}</span>
                          {stud.studentCode && (
                            <span className="font-mono text-xs text-slate-400">
                              • {stud.studentCode}
                            </span>
                          )}
                        </div>
                      </div>
                      {stud.whatsappNumber && (
                        <a
                          href={`https://wa.me/${stud.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Hello, this is ${teacherName} from Xello Tuition about ${studentName}'s tuition classes.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-sm font-semibold text-slate-300 hover:text-white"
                          title="WhatsApp parent"
                        >
                          <MessageCircle className="h-4 w-4 text-teal-400" aria-hidden="true" /> WhatsApp<span className="sr-only"> parent of {studentName}</span>
                        </a>
                      )}
                    </div>

                    {/* Assigned Subjects with Timetables & Credit Allocations */}
                    <div className="mt-3 space-y-2.5">
                      {(stud.assignedSubjects || []).map((sub: any) => {
                        const subId = sub.subjectId || sub.id;
                        const subName = sub.subjectName || sub.name;

                        return (
                          <div
                            key={subId}
                            className="rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span
                                className="rounded-md border px-2 py-0.5 text-sm font-bold text-ink"
                                style={{
                                  backgroundColor: (sub.subjectColor || "#14b8a6") + "20",
                                  borderColor: (sub.subjectColor || "#14b8a6") + "80",
                                }}
                              >
                                {subName}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setMarkingSubject({
                                    student: {
                                      id: studentId,
                                      name: studentName,
                                      grade: stud.grade,
                                    },
                                    subject: {
                                      id: subId,
                                      name: subName,
                                    },
                                  })
                                }
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal-400 px-3 text-sm font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-sm"
                              >
                                <ClipboardList className="h-4 w-4" aria-hidden="true" /> Mark Attendance<span className="sr-only"> for {studentName}, {subName}</span>
                              </button>
                            </div>

                            {/* Scheduled Class Days & Timings */}
                            <div className="text-xs text-slate-300 flex items-start gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
                              <div>
                                {sub.schedules && sub.schedules.length > 0 ? (
                                  <span className="text-slate-300">
                                    {sub.schedules.map((s: any) => s.timeDisplay).join(" • ")}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">No scheduled timetable slots</span>
                                )}
                              </div>
                            </div>

                            {/* Class Credits Allocated, Completed, Remaining */}
                            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/60 text-center">
                              <div className="bg-slate-950/60 rounded px-1.5 py-1">
                                <span className="block text-xs text-slate-400">Allocated</span>
                                <span className="text-xs font-bold text-white">
                                  {sub.hasSubjectAllocation && sub.allocatedCredits !== null
                                    ? `${sub.allocatedCredits} Cls`
                                    : "Not Set"}
                                </span>
                              </div>
                              <div className="bg-slate-950/60 rounded px-1.5 py-1">
                                <span className="block text-xs text-slate-400">Completed</span>
                                <span className="text-xs font-bold text-teal-300">
                                  {sub.completedClasses ?? 0} Cls
                                </span>
                              </div>
                              <div className="bg-slate-950/60 rounded px-1.5 py-1">
                                <span className="block text-xs text-slate-400">Remaining</span>
                                <span
                                  className={`text-xs font-bold ${
                                    sub.remainingCredits !== null && sub.remainingCredits <= 2
                                      ? "text-rose-400"
                                      : "text-emerald-400"
                                  }`}
                                >
                                  {sub.hasSubjectAllocation && sub.remainingCredits !== null
                                    ? `${sub.remainingCredits} Cls`
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <Link
                      href={`/students/${studentId}`}
                      className="inline-flex min-h-[44px] items-center text-sm font-bold text-teal-400 hover:text-teal-300 hover:underline"
                    >
                      View Subject Profile & Timetable →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Date Picker for Schedule View */}
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-lg">
        <button
          type="button"
          onClick={() => go(addDaysToLocalDate(currentDate, -1))}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous day
        </button>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="portal-date" className="mb-1 block text-xs font-semibold text-slate-400">
            Timetable Date (IST)
          </label>
          <input
            id="portal-date"
            type="date"
            value={currentDate}
            onChange={(e) => go(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-white sm:text-sm focus:border-teal-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => go(addDaysToLocalDate(currentDate, 1))}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Next day <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={() => go(todayDate)}
            className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-teal-300 hover:bg-slate-800"
          >
            Today
          </button>
        )}
      </div>

      {/* Timetable / Schedule Display Section */}
      <section
        aria-labelledby="portal-day-heading"
        className="rounded-2xl border border-slate-800/80 bg-slate-900/90 shadow-xl overflow-hidden"
      >
        <div className="border-b border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 id="portal-day-heading" className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-400" aria-hidden="true" />
            Timetable Schedule: {isToday ? "Today" : dateLabel} ({sessions.length} class{sessions.length === 1 ? "" : "es"})
          </h2>
          <span className="text-xs text-slate-400">
            Display-only schedule · No automatic attendance or credit deduction
          </span>
        </div>

        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            No classes scheduled for you on {dateLabel}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {sessions.map((s) => {
              const started = new Date(s.scheduledStartTimeUtc).getTime() <= now;
              const state = s.attendance
                ? {
                    label: `Attendance Confirmed: ${OUTCOME_LABELS[s.attendance.sessionOutcome] ?? s.attendance.sessionOutcome}`,
                    cls: "border-emerald-400/40 text-emerald-400 bg-emerald-500/10",
                  }
                : s.status === "SCHEDULED" && started
                ? { label: "Attendance Pending", cls: "border-amber-300/50 text-amber-300 bg-amber-500/10" }
                : s.status === "SCHEDULED"
                ? { label: "Upcoming (Display Only)", cls: "border-slate-700 text-slate-400 bg-slate-800/40" }
                : { label: OUTCOME_LABELS[s.status] ?? s.status, cls: "border-slate-700 text-slate-400" };

              // Check if student is in myStudents to allow marking
              const matchedStudent = myStudents.find((ms) => ms.name === s.student.name);

              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums text-white text-sm">
                      {formatTimeOnly(s.scheduledStartTimeUtc)}–{formatTimeOnly(s.scheduledEndTimeUtc)} IST
                    </p>
                    <p className="text-white text-sm break-words mt-0.5">
                      {s.student.name}{" "}
                      <span className="text-slate-400">
                        · {s.subject.name} · {s.student.grade}
                      </span>
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${state.cls}`}
                    >
                      {state.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {s.student.whatsappNumber && (
                      <a
                        href={`https://wa.me/${s.student.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Hello, this is ${teacherName} from Xello Tuition about ${s.student.name}'s ${s.subject.name} class.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-sm font-semibold text-slate-300 hover:text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                    {s.attendance ? (
                      <Link
                        href={`/attendance?session=${s.id}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-sm font-semibold text-slate-300 hover:text-white"
                      >
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                        View Attendance
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMarkingSubject({
                            student: {
                              id: (s as any).studentId || "",
                              name: s.student.name,
                              grade: s.student.grade,
                            },
                            subject: {
                              id: (s as any).subjectId || "",
                              name: s.subject.name,
                            },
                          });
                        }}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-400 px-3 text-sm font-bold text-slate-950 hover:bg-teal-300 shadow-sm"
                      >
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark Attendance
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Manual Attendance Modal */}
      {markingSubject && (
        <MarkAttendanceModal
          isOpen={true}
          onClose={() => setMarkingSubject(null)}
          onSuccess={handleAttendanceSuccess}
          preselectedStudent={{
            id: markingSubject.student.id,
            name: markingSubject.student.name,
            grade: markingSubject.student.grade,
            assignedSubjects: [markingSubject.subject],
          }}
          preselectedSubject={markingSubject.subject}
          isTrainer={true}
          currentTrainerId={teacherId}
          currentTrainerName={teacherName}
        />
      )}
    </div>
  );
}
