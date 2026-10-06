"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileEdit,
  History,
  X,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

interface AttendanceClientProps {
  missingSessions: any[];
  allRecords: any[];
  teacherAbsences: any[];
  currentUserRole: string;
}

export function AttendanceClient({
  missingSessions,
  allRecords,
  teacherAbsences,
  currentUserRole,
}: AttendanceClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"inbox" | "history" | "absences">("inbox");

  // Submit attendance modal state
  const [submitSession, setSubmitSession] = useState<any | null>(null);
  const [outcome, setOutcome] = useState("COMPLETED");
  const [attendance, setAttendance] = useState("PRESENT");
  const [duration, setDuration] = useState("60");
  const [topic, setTopic] = useState("");
  const [homework, setHomework] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Correction modal state
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [newOutcome, setNewOutcome] = useState("COMPLETED");
  const [newAttendance, setNewAttendance] = useState("PRESENT");
  const [correctionReason, setCorrectionReason] = useState("");

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitSession) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/sessions/${submitSession.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionOutcome: outcome,
          studentAttendance: attendance,
          actualDurationMinutes: Number(duration) || 60,
          topicCovered: topic,
          homework,
          studentProgressNote: progressNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit attendance");
      }

      setSubmitSession(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/attendance/${correctingRecord.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newOutcome,
          newAttendance,
          reason: correctionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to correct attendance");
      }

      setCorrectingRecord(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Attendance & Credit Consumption</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Attendance Operations & Inbox
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit session outcomes, enforce credit deduction policies, and perform audited attendance reversals.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "inbox"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          Missing Attendance Inbox ({missingSessions.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "history"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="h-4 w-4" />
          Attendance History & Revisions ({allRecords.length})
        </button>
        <button
          onClick={() => setActiveTab("absences")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "absences"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Teacher Absences ({teacherAbsences.length})
        </button>
      </div>

      {/* Tab 1: Missing Attendance Inbox */}
      {activeTab === "inbox" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Past Scheduled Classes Awaiting Attendance Submission
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {missingSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Inbox is clear! No past classes have missing attendance.
              </div>
            ) : (
              missingSessions.map((ses) => (
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
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                          {ses.subject.name}
                        </span>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Attendance Pending
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Tutor: <strong>{ses.teacher.name}</strong> • Scheduled:{" "}
                        {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSubmitSession(ses);
                      setTopic("");
                      setHomework("");
                      setProgressNote("");
                      setErrorMsg("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Submit Attendance
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Attendance History & Audited Corrections */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Completed Session Records ({allRecords.length})
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {allRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {rec.session.student.name} • {rec.session.subject.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.sessionOutcome === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : rec.sessionOutcome === "TEACHER_NO_SHOW"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rec.sessionOutcome}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {rec.studentAttendance}
                    </span>
                    {rec.isReversed && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                        REVERSED
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600">
                    <strong>Topic:</strong> {rec.topicCovered}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Marked by {rec.markedByName} ({rec.markedByRole}) • {formatInTimeZone(rec.markedAt, "Asia/Kolkata")} IST
                  </div>
                  {rec.reversalReason && (
                    <div className="text-red-700 bg-red-50 p-2 rounded text-[11px] mt-1">
                      <strong>Reversal Reason:</strong> {rec.reversalReason} (by {rec.reversedByName})
                    </div>
                  )}
                </div>

                {/* Correction trigger (for Admin/Coordinator) */}
                {(currentUserRole === "OWNER" || currentUserRole === "COORDINATOR") && (
                  <button
                    onClick={() => {
                      setCorrectingRecord(rec);
                      setNewOutcome(rec.sessionOutcome);
                      setNewAttendance(rec.studentAttendance);
                      setCorrectionReason("");
                      setErrorMsg("");
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                  >
                    Audited Correction
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Teacher Absences (Never Consumes Credit) */}
      {activeTab === "absences" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm bg-amber-50 p-3 rounded-xl border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Mandatory Business Policy: Teacher absence NEVER consumes student package credits.
          </div>
          <div className="divide-y divide-slate-100">
            {teacherAbsences.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Zero teacher absences recorded.
              </div>
            ) : (
              teacherAbsences.map((rec) => (
                <div key={rec.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{rec.session.teacher.name} • {rec.session.subject.name} with {rec.session.student.name}</span>
                    <span className="text-red-700 font-semibold">Credit Consumed: 0 (Protected)</span>
                  </div>
                  <div className="text-slate-500">
                    Note: {rec.topicCovered}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Submit Attendance Modal */}
      {submitSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Submit Class Attendance
              </h3>
              <button
                onClick={() => setSubmitSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAttendanceSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-slate-900">
                  {submitSession.student.name} • {submitSession.subject.name}
                </span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tutor: {submitSession.teacher.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Session Outcome *
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-medium text-slate-900"
                  >
                    <option value="COMPLETED">Completed (Deducts 1 Credit)</option>
                    <option value="STUDENT_NO_SHOW">Student No-Show</option>
                    <option value="TEACHER_NO_SHOW">Teacher No-Show (No Credit Deducted)</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Student Attendance *
                  </label>
                  <select
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-medium text-slate-900"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Topic Covered *
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Chemical Bonding - Hybridization and VSEPR Theory"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Homework Assigned
                </label>
                <input
                  type="text"
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="e.g. Chapter 4 exercise questions 1-10"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Student Progress Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="e.g. Very receptive today; mastered tetrahedral geometry"
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
                  onClick={() => setSubmitSession(null)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Submit & Update Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audited Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Audited Attendance Correction
              </h3>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-slate-900">
                  {correctingRecord.session.student.name} • {correctingRecord.session.subject.name}
                </span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Previous: {correctingRecord.sessionOutcome} ({correctingRecord.studentAttendance})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    New Outcome *
                  </label>
                  <select
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-medium text-slate-900"
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="STUDENT_NO_SHOW">Student No-Show</option>
                    <option value="TEACHER_NO_SHOW">Teacher No-Show</option>
                    <option value="CANCELLED">Cancelled (Refunds Credit)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    New Attendance *
                  </label>
                  <select
                    value={newAttendance}
                    onChange={(e) => setNewAttendance(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-medium text-slate-900"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Correction Reason (Audited) *
                </label>
                <input
                  type="text"
                  required
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Medical emergency notice verified with guardian; reversed credit"
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
                  onClick={() => setCorrectingRecord(null)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Reversing..." : "Apply Audited Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
