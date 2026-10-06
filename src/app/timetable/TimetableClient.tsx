"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Video,
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

interface TimetableClientProps {
  sessions: any[];
  students: any[];
  teachers: any[];
  subjects: any[];
}

export function TimetableClient({
  sessions,
  students,
  teachers,
  subjects,
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
  const [meetingUrl, setMeetingUrl] = useState("https://meet.google.com/xello-class");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reschedule form states
  const [newStartTimeLocal, setNewStartTimeLocal] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // Filtered sessions
  const filteredSessions = sessions.filter((ses) => {
    if (selectedSubject !== "ALL" && ses.subjectId !== selectedSubject) return false;
    if (selectedTeacher !== "ALL" && ses.teacherId !== selectedTeacher) return false;
    if (selectedStatus !== "ALL" && ses.status !== selectedStatus) return false;
    return true;
  });

  const handleStudentSelect = (id: string) => {
    setStudentId(id);
    const stu = students.find((s) => s.id === id);
    if (stu?.packages?.[0]) {
      setPackageId(stu.packages[0].id);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const utcDate = new Date(startTimeLocal).toISOString();

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          studentId,
          teacherId,
          subjectId,
          scheduledStartTimeUtc: utcDate,
          durationMinutes: 60,
          meetingUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to schedule session");
      }

      setScheduleModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
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
      const utcDate = new Date(newStartTimeLocal).toISOString();

      const res = await fetch(`/api/sessions/${rescheduleSession.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newScheduledStartTimeUtc: utcDate,
          durationMinutes: 60,
          reason: rescheduleReason || "Requested timing change",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reschedule session");
      }

      setRescheduleSession(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Schedule Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <CalendarDays className="h-4 w-4" />
            <span>One-to-One Timetable Engine</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Class Schedule & Bookings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage live schedules with student/teacher conflict checks and package credit reservation tracking.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg("");
            setScheduleModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          Schedule New Class
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
          <Filter className="h-4 w-4 text-teal-600" />
          Filters:
        </div>

        {/* Subject Filter */}
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-800"
        >
          <option value="ALL">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Teacher Filter */}
        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-800"
        >
          <option value="ALL">All Teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-800"
        >
          <option value="ALL">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="RESCHEDULED">Rescheduled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Timetable Sessions List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Sessions ({filteredSessions.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Displays both IST (Kerala) & Student Local Time (GCC)
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No sessions found matching filters.
            </div>
          ) : (
            filteredSessions.map((ses) => (
              <div
                key={ses.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-2.5 h-12 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: ses.subject.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {ses.student.name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {ses.student.grade}
                      </span>
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                        {ses.subject.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ses.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ses.status === "SCHEDULED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {ses.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>Tutor: <strong>{ses.teacher.name}</strong></span>
                      <span>•</span>
                      <span>
                        Package: {ses.package.name} ({ses.isCreditReserved ? "Credit Reserved" : "Credit Consumed"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Date, Timings & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">
                      {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatInTimeZone(ses.scheduledStartTimeUtc, ses.student.timeZone)} ({ses.student.country} Local)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ses.meetingUrl && (
                      <a
                        href={ses.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 flex items-center gap-1"
                      >
                        <Video className="h-3.5 w-3.5" /> Join
                      </a>
                    )}
                    {ses.status === "SCHEDULED" && !ses.isCreditConsumed && (
                      <button
                        onClick={() => {
                          setRescheduleSession(ses);
                          setErrorMsg("");
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Reschedule
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Schedule One-to-One Class
              </h3>
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  1. Select Student *
                </label>
                <select
                  required
                  value={studentId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
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
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  2. Select Subject *
                </label>
                <select
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="">Choose Subject...</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  3. Select Tutor *
                </label>
                <select
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="">Choose Tutor...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subjects})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  4. Class Date & Start Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTimeLocal}
                  onChange={(e) => setStartTimeLocal(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Meeting Link
                </label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Checking Conflicts..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Reschedule Class Session
              </h3>
              <button
                onClick={() => setRescheduleSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-slate-900">
                  {rescheduleSession.student.name} • {rescheduleSession.subject.name}
                </span>
                <div className="text-[11px] text-slate-500 mt-1">
                  Current: {formatInTimeZone(rescheduleSession.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  New Date & Start Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newStartTimeLocal}
                  onChange={(e) => setNewStartTimeLocal(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Reason for Rescheduling *
                </label>
                <input
                  type="text"
                  required
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Student school function in Dubai; moved to Friday"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleSession(null)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Rescheduling..." : "Save Replacement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
