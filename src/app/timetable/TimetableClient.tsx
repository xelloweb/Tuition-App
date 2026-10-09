"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Video,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/lib/client-api";

interface TimetableClientProps {
  sessions: any[];
  students: any[];
  teachers: any[];
  subjects: any[];
  canSchedule: boolean;
}

export function TimetableClient({
  sessions,
  students,
  teachers,
  subjects,
  canSchedule,
}: TimetableClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"list" | "day" | "week">("list");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [selectedTeacher, setSelectedTeacher] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [rescheduleSession, setRescheduleSession] = useState<any | null>(null);

  // Form states
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [startTimeLocal, setStartTimeLocal] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reschedule form states
  const [newStartTimeLocal, setNewStartTimeLocal] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleCancelClass = async (ses: any) => {
    const reason = prompt(
      `Cancel ${ses.student.name}'s ${ses.subject.name} class? Cancellations inside the package notice period follow the no-show credit rule.\n\nReason:`
    );
    if (reason === null) return;
    setActionLoadingId(ses.id);
    try {
      await apiRequest(`/api/sessions/${ses.id}/attendance`, {
        method: "POST",
        body: {
          sessionOutcome: "CANCELLED",
          studentAttendance: "ABSENT",
          actualDurationMinutes: 0,
          topicCovered: `Cancelled${reason.trim() ? `: ${reason.trim()}` : ""}`,
        },
      });
      setBanner({ tone: "success", text: `${ses.subject.name} class cancelled. The audit trail and credit ledger record the outcome.` });
      router.refresh();
    } catch (err: any) {
      setBanner({ tone: "error", text: errorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered sessions
  const filteredSessions = sessions.filter((ses) => {
    if (selectedSubject !== "ALL" && ses.subjectId !== selectedSubject) return false;
    if (selectedTeacher !== "ALL" && ses.teacherId !== selectedTeacher) return false;
    if (selectedStatus !== "ALL" && ses.status !== selectedStatus) return false;
    return true;
  });

  const selectedStudent = students.find((s) => s.id === studentId);
  const enrolledSubjectIds: string[] = selectedStudent?.enrolments?.map((e: any) => e.subjectId) ?? [];
  const subjectChoices = selectedStudent && enrolledSubjectIds.length
    ? subjects.filter((s) => enrolledSubjectIds.includes(s.id))
    : subjects;
  const packageChoices: any[] = (selectedStudent?.packages ?? []).filter(
    (p: any) => !subjectId || p.allocations.some((a: any) => a.subjectId === subjectId)
  );

  // Every dependent choice is reset so a previous student's package can never be reused.
  const handleStudentSelect = (id: string) => {
    setStudentId(id);
    setSubjectId("");
    setTeacherId("");
    const stu = students.find((s) => s.id === id);
    setPackageId(stu?.packages?.length === 1 ? stu.packages[0].id : "");
  };

  const handleSubjectSelect = (id: string) => {
    setSubjectId(id);
    const enrolment = selectedStudent?.enrolments?.find((e: any) => e.subjectId === id);
    setTeacherId(enrolment?.teacherId ?? "");
    const eligible = (selectedStudent?.packages ?? []).filter((p: any) => p.allocations.some((a: any) => a.subjectId === id));
    setPackageId(eligible[0]?.id ?? "");
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (!packageId) throw new Error("Choose a package that has classes for this subject.");
      const start = new Date(startTimeLocal);
      if (Number.isNaN(start.getTime())) throw new Error("Choose the class date and start time.");
      const pkg = packageChoices.find((p: any) => p.id === packageId);

      await apiRequest("/api/sessions", {
        method: "POST",
        body: {
          packageId,
          studentId,
          teacherId,
          subjectId,
          scheduledStartTimeUtc: start.toISOString(),
          durationMinutes: pkg?.durationMinutes ?? 60,
          meetingUrl: meetingUrl.trim() || null,
        },
      });

      setScheduleModalOpen(false);
      setBanner({ tone: "success", text: "Class booked and one credit reserved." });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleSession) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const start = new Date(newStartTimeLocal);
      if (Number.isNaN(start.getTime())) throw new Error("Choose the new date and start time.");

      await apiRequest(`/api/sessions/${rescheduleSession.id}/reschedule`, {
        method: "POST",
        body: {
          newScheduledStartTimeUtc: start.toISOString(),
          durationMinutes: rescheduleSession.durationMinutes || 60,
          reason: rescheduleReason || "Requested timing change",
        },
      });

      setRescheduleSession(null);
      setBanner({ tone: "success", text: "Class rescheduled. The original booking is kept in history as rescheduled." });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Schedule Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <CalendarDays className="h-4 w-4" />
            <span>One-to-One Timetable Engine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Class Schedule & Bookings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage live schedules with student/teacher conflict checks and package credit reservation tracking.
          </p>
        </div>

        {canSchedule && (
        <Button
          onClick={() => {
            setErrorMsg("");
            setScheduleModalOpen(true);
          }}
          icon={Plus}
          className="w-full sm:w-auto"
        >
          Schedule New Class
        </Button>
        )}
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs font-semibold ${
            banner.tone === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1 shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900 p-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-xs">
          <Filter className="h-4 w-4 text-teal-400" />
          Filters:
        </div>

        {/* Subject Filter */}
        <select
          value={selectedSubject}
          aria-label="Filter by subject"
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-base font-medium text-slate-200 focus:outline-hidden sm:text-sm"
        >
          <option value="ALL" className="bg-slate-900 text-slate-200">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">{s.name}</option>
          ))}
        </select>

        {/* Teacher Filter */}
        <select
          value={selectedTeacher}
          aria-label="Filter by trainer"
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-base font-medium text-slate-200 focus:outline-hidden sm:text-sm"
        >
          <option value="ALL" className="bg-slate-900 text-slate-200">All trainers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">{t.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          aria-label="Filter by status"
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-base font-medium text-slate-200 focus:outline-hidden sm:text-sm"
        >
          <option value="ALL" className="bg-slate-900 text-slate-200">All Statuses</option>
          <option value="SCHEDULED" className="bg-slate-900 text-slate-200">Scheduled</option>
          <option value="COMPLETED" className="bg-slate-900 text-slate-200">Completed</option>
          <option value="RESCHEDULED" className="bg-slate-900 text-slate-200">Rescheduled</option>
          <option value="CANCELLED" className="bg-slate-900 text-slate-200">Cancelled</option>
        </select>
      </div>

      {/* Timetable Sessions List */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            Sessions ({filteredSessions.length})
          </span>
          <span className="text-xs text-slate-400">
            Displays both IST (Kerala) & Student Local Time (GCC)
          </span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {filteredSessions.length === 0 ? (
            <div className="p-8 sm:p-14 text-center">
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/90 border border-slate-700/80 text-teal-400">
                  <CalendarDays className="h-7 w-7 text-teal-400" />
                </div>
                <h3 className="mt-4 text-base font-extrabold text-white">No classes scheduled</h3>
                <p className="mt-1.5 max-w-sm text-xs text-slate-400 leading-relaxed">
                  Book class slots for students and assign available faculty tutors.
                </p>
                <div className="mt-6">
                  <Button
                    size="md"
                    onClick={() => {
                      setErrorMsg("");
                      setScheduleModalOpen(true);
                    }}
                  >
                    Schedule First Class
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            filteredSessions.map((ses) => (
              <div
                key={ses.id}
                className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-2.5 h-12 rounded-full mt-1 shrink-0 shadow-sm"
                    style={{ backgroundColor: ses.subject.color }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-white">
                        {ses.student.name}
                      </span>
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">
                        {ses.student.grade}
                      </span>
                      <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-xs font-bold text-teal-300">
                        {ses.subject.name}
                      </span>
                      <StatusBadge status={ses.status} size="sm" />
                      {ses.timetableSlotId && (
                        <span className="rounded-full bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 text-xs font-bold text-teal-300">Weekly</span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Trainer: <strong className="text-slate-200">{ses.teacher.name}</strong></span>
                      <span>•</span>
                      <span>
                        Package: {ses.package.name} ({ses.isCreditReserved ? "Credit Reserved" : "Credit Consumed"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Date, Timings & Actions */}
                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold text-white font-mono">
                      {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {ses.student?.whatsappNumber && (
                      <a
                        href={`https://wa.me/${ses.student.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hello, this is regarding ${ses.student.name}'s ${ses.subject?.name || "tuition"} class.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1.5 transition-all shadow-sm"
                        title={`WhatsApp ${ses.student.name} (${ses.student.whatsappNumber})`}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {ses.status === "SCHEDULED" && !ses.isCreditConsumed && (
                      <>
                        {new Date(ses.scheduledStartTimeUtc) <= new Date() && (
                          <Link
                            href={`/attendance?session=${ses.id}`}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-400 px-3 text-sm font-bold text-slate-950 hover:bg-teal-300"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Mark attendance<span className="sr-only"> for {ses.student.name}</span>
                          </Link>
                        )}

                        {canSchedule && (
                          <button
                            onClick={() => {
                              setRescheduleSession(ses);
                              setErrorMsg("");
                            }}
                            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 min-h-[44px] text-sm font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            Reschedule
                          </button>
                        )}
                        {canSchedule && new Date(ses.scheduledStartTimeUtc) > new Date() && (
                          <button
                            onClick={() => handleCancelClass(ses)}
                            disabled={actionLoadingId === ses.id}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 min-h-[44px] text-sm font-bold text-rose-300 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Class Modal */}
      {scheduleModalOpen && (
        <ModalShell labelledBy="schedule-title" onClose={() => setScheduleModalOpen(false)} maxWidth="max-w-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 id="schedule-title" className="text-base font-bold text-white">
                Schedule One-to-One Class
              </h2>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label htmlFor="timetableclient-field-1" className="block font-bold text-slate-300 uppercase mb-1">
                  1. Select Student *
                </label>
                <select id="timetableclient-field-1"
                  required
                  value={studentId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                >
                  <option value="">Choose Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentCode} • {s.grade} • {s.country})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timetableclient-field-2" className="block font-bold text-slate-300 uppercase mb-1">
                  2. Select Subject *
                </label>
                <select id="timetableclient-field-2"
                  required
                  value={subjectId}
                  onChange={(e) => handleSubjectSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                >
                  <option value="">Choose Subject...</option>
                  {subjectChoices.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timetableclient-field-3" className="block font-bold text-slate-300 uppercase mb-1">
                  3. Select Tutor *
                </label>
                <select id="timetableclient-field-3"
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                >
                  <option value="">Choose a trainer…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subjects})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timetableclient-field-4" className="block font-bold text-slate-300 uppercase mb-1">
                  Package (credits are reserved from it) *
                </label>
                <select id="timetableclient-field-4"
                  required
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  disabled={!studentId}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden disabled:opacity-50"
                >
                  <option value="">{studentId ? (packageChoices.length ? "Choose Package..." : "No active package covers this subject") : "Choose a student first"}</option>
                  {packageChoices.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.packageNumber} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timetableclient-field-5" className="block font-bold text-slate-300 uppercase mb-1">
                  4. Class Date & Start Time (your device time zone) *
                </label>
                <input id="timetableclient-field-5"
                  type="datetime-local"
                  required
                  value={startTimeLocal}
                  onChange={(e) => setStartTimeLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="timetableclient-field-6" className="block font-bold text-slate-300 uppercase mb-1">
                  Meeting Link
                </label>
                <input id="timetableclient-field-6"
                  type="url"
                  value={meetingUrl}
                  placeholder="https://meet.google.com/... (optional)"
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="inline-flex items-center min-h-[44px] rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center min-h-[44px] rounded-xl bg-teal-400 px-5 py-2.5 font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? "Checking Conflicts..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </ModalShell>
      )}

      {/* Reschedule Modal */}
      {rescheduleSession && (
        <ModalShell labelledBy="reschedule-title" onClose={() => setRescheduleSession(null)} maxWidth="max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 id="reschedule-title" className="text-base font-bold text-white">
                Reschedule Class Session
              </h2>
              <button
                onClick={() => setRescheduleSession(null)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
                <span className="font-bold text-white">
                  {rescheduleSession.student.name} • {rescheduleSession.subject.name}
                </span>
                <div className="text-xs text-slate-400 mt-1">
                  Current: {formatInTimeZone(rescheduleSession.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                </div>
              </div>

              <div>
                <label htmlFor="timetableclient-field-7" className="block font-bold text-slate-300 uppercase mb-1">
                  New Date & Start Time *
                </label>
                <input id="timetableclient-field-7"
                  type="datetime-local"
                  required
                  value={newStartTimeLocal}
                  onChange={(e) => setNewStartTimeLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="timetableclient-field-8" className="block font-bold text-slate-300 uppercase mb-1">
                  Reason for Rescheduling *
                </label>
                <input id="timetableclient-field-8"
                  type="text"
                  required
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Student school function in Dubai; moved to Friday"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleSession(null)}
                  className="inline-flex items-center min-h-[44px] rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center min-h-[44px] rounded-xl bg-teal-400 px-5 py-2.5 font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? "Rescheduling..." : "Save Replacement"}
                </button>
              </div>
            </form>
          </ModalShell>
      )}
    </div>
  );
}
