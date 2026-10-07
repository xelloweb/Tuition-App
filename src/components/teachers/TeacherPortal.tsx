"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, MessageCircle } from "lucide-react";
import { formatDateOnly, formatTimeOnly } from "@/lib/timezones";
import { addDaysToLocalDate } from "@/lib/zoned-time";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";

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

/** Trainer workspace: pick an IST date, see only your own classes and their attendance state. */
export function TeacherPortal({
  teacherName,
  sessions,
  currentDate,
  todayDate,
  pendingCount,
}: {
  teacherName: string;
  sessions: PortalSession[];
  currentDate: string;
  todayDate: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const go = (date: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) router.push(date === todayDate ? "/" : `/?date=${date}`);
  };
  const dateLabel = formatDateOnly(`${currentDate}T12:00:00+05:30`);
  const isToday = currentDate === todayDate;
  const [now] = useState(() => Date.now());

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="My classes" context={`${teacherName} · times in IST`} description="Choose a date to see your classes. Mark attendance after each class." />

      {pendingCount > 0 && (
        <Notice tone="warning" title={`${pendingCount} past class${pendingCount === 1 ? "" : "es"} still need attendance`}>
          <Link href="/attendance" className="font-semibold underline">Open attendance</Link>
        </Notice>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-card border border-line bg-surface p-3">
        <button
          type="button"
          onClick={() => go(addDaysToLocalDate(currentDate, -1))}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous day
        </button>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="portal-date" className="mb-1 block text-sm font-semibold text-ink-muted">Date</label>
          <input
            id="portal-date"
            type="date"
            value={currentDate}
            onChange={(e) => go(e.target.value)}
            className="min-h-[44px] w-full rounded-control border border-line-strong bg-raised px-3 text-base text-ink sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => go(addDaysToLocalDate(currentDate, 1))}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
        >
          Next day <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {!isToday && (
          <button type="button" onClick={() => go(todayDate)} className="inline-flex min-h-[44px] items-center rounded-control px-3 text-sm font-semibold text-brand-text hover:bg-raised">
            Today
          </button>
        )}
      </div>

      <section aria-labelledby="portal-day-heading" className="rounded-card border border-line bg-surface">
        <h2 id="portal-day-heading" className="border-b border-line p-4 text-lg font-semibold text-ink">
          {isToday ? "Today" : dateLabel} ({sessions.length} class{sessions.length === 1 ? "" : "es"})
        </h2>
        {sessions.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">No classes assigned to you on {dateLabel}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((s) => {
              const started = new Date(s.scheduledStartTimeUtc).getTime() <= now;
              const state = s.attendance
                ? { label: `Attendance submitted: ${OUTCOME_LABELS[s.attendance.sessionOutcome] ?? s.attendance.sessionOutcome}`, cls: "border-emerald-400/40 text-success" }
                : s.status === "SCHEDULED" && started
                  ? { label: "Attendance pending", cls: "border-amber-300/50 text-warning" }
                  : s.status === "SCHEDULED"
                    ? { label: "Upcoming", cls: "border-line-strong text-ink-muted" }
                    : { label: OUTCOME_LABELS[s.status] ?? s.status, cls: "border-line-strong text-ink-muted" };
              return (
                <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums text-ink">
                      {formatTimeOnly(s.scheduledStartTimeUtc)}–{formatTimeOnly(s.scheduledEndTimeUtc)}
                    </p>
                    <p className="text-ink break-words">
                      {s.student.name} <span className="text-ink-muted">· {s.subject.name} · {s.student.grade}</span>
                    </p>
                    <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-sm ${state.cls}`}>{state.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.student.whatsappNumber && (
                      <a
                        href={`https://wa.me/${s.student.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, this is ${teacherName} from Xello Tuition about ${s.student.name}'s ${s.subject.name} class.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp<span className="sr-only"> {s.student.name}&apos;s parent</span>
                      </a>
                    )}
                    {(s.attendance || (s.status === "SCHEDULED" && started)) && (
                      <Link
                        href={`/attendance?session=${s.id}`}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-control px-3 text-sm font-semibold ${
                          s.attendance ? "border border-line-strong text-ink hover:bg-raised" : "bg-brand text-brand-ink hover:bg-brand-hover"
                        }`}
                      >
                        <ClipboardList className="h-4 w-4" aria-hidden="true" />
                        {s.attendance ? "View attendance" : "Mark attendance"}
                        <span className="sr-only"> for {s.student.name}</span>
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
