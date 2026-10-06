"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  History,
  X,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Zap,
  DollarSign,
  GraduationCap,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { MobileTabs } from "@/components/ui/MobileTabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest, errorMessage } from "@/lib/client-api";

interface AttendanceClientProps {
  missingSessions: any[];
  allRecords: any[];
  teacherAbsences: any[];
  currentUserRole: string;
  canCorrect: boolean;
}

export function AttendanceClient({
  missingSessions,
  allRecords,
  teacherAbsences,
  currentUserRole,
  canCorrect,
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

  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Rates are computed on the server and are null when this role may not see them.
  const calculateTrainerEarnings = (ratePerHour: number, durationMins: number) => {
    return Math.round((ratePerHour * durationMins) / 60);
  };

  const postAttendance = (sessionId: string, body: Record<string, unknown>) =>
    apiRequest<{ alreadyProcessed?: boolean; message?: string }>(`/api/sessions/${sessionId}/attendance`, {
      method: "POST",
      body,
    });

  // Quick 1-Click submit for standard completed class
  const handleQuickMarkDone = async (ses: any) => {
    if (loading) return;
    setLoading(true);
    setBanner(null);
    try {
      const data = await postAttendance(ses.id, {
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: ses.durationMinutes || 60,
        topicCovered: `Regular Curriculum Session (${ses.subject.name})`,
        homework: "Revise concepts covered in class",
      });
      setBanner({ tone: "success", text: data.alreadyProcessed ? data.message || "Already recorded." : `Marked ${ses.student.name}'s ${ses.subject.name} class as completed.` });
      router.refresh();
    } catch (err: any) {
      setBanner({ tone: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Click submit for absent student
  const handleQuickMarkAbsent = async (ses: any) => {
    if (loading) return;
    if (!confirm(`Mark ${ses.student.name} as ABSENT for this class?`)) return;
    setLoading(true);
    setBanner(null);
    try {
      const data = await postAttendance(ses.id, {
        sessionOutcome: "STUDENT_NO_SHOW",
        studentAttendance: "ABSENT",
        actualDurationMinutes: ses.durationMinutes || 60,
        topicCovered: "Student Absent (No Show)",
      });
      setBanner({ tone: "success", text: data.alreadyProcessed ? data.message || "Already recorded." : `Marked ${ses.student.name} absent.` });
      router.refresh();
    } catch (err: any) {
      setBanner({ tone: "error", text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitSession || loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await postAttendance(submitSession.id, {
        sessionOutcome: outcome,
        studentAttendance: attendance,
        actualDurationMinutes: Number(duration) || 60,
        topicCovered: topic.trim() || `Class session for ${submitSession.subject.name}`,
        homework,
        studentProgressNote: progressNote,
      });
      setSubmitSession(null);
      setBanner({ tone: "success", text: data.alreadyProcessed ? data.message || "Already recorded." : "Attendance saved." });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord || loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await apiRequest<{ warnings?: string[] }>(`/api/attendance/${correctingRecord.id}/correct`, {
        method: "POST",
        body: { newOutcome, newAttendance, reason: correctionReason },
      });
      setCorrectingRecord(null);
      setBanner({
        tone: data.warnings?.length ? "error" : "success",
        text: ["Attendance corrected; the change is recorded in the revision history and credit ledger.", ...(data.warnings ?? [])].join(" "),
      });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Active modal trainer rate calculation (null = not visible to this role)
  const modalHourlyRate: number | null = submitSession?.hourlyRate ?? null;
  const modalDurationMins = Number(duration) || 60;
  const modalDurationHours = (modalDurationMins / 60).toFixed(2);
  const modalTrainerEarnings = outcome === "COMPLETED" && modalHourlyRate !== null
    ? calculateTrainerEarnings(modalHourlyRate, modalDurationMins)
    : 0;

  return (
    <div className="space-y-6">
      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs font-semibold ${
            banner.tone === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-amber-500/15 border-amber-500/30 text-amber-100"
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" className="p-1 shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Attendance & Trainer Hourly Earnings</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Teacher Attendance & Class Delivery
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mark attendance in 1 click. Trainers earn based on student standard and hours taught.
          </p>
        </div>
      </div>

      {/* Trainer Rate by Standard Explainer Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-teal-500/30 bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl shadow-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-extrabold text-sm text-teal-300">
              <Zap className="h-4 w-4 text-teal-400" />
              How Trainer Earnings Work (Hourly Standard Rates)
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Each student standard (8th, 9th, 10th, 11th, 12th) has a specific hourly charge. When a class is marked completed, the app automatically calculates earnings:
              <span className="font-semibold text-white ml-1">
                Trainer Earnings = (Standard Rate per Hour) × (Class Hours Taught)
              </span>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs shrink-0">
            <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase">8th–9th Std</div>
              <div className="font-black text-white mt-0.5">₹450 – ₹500<span className="text-[10px] font-normal text-slate-400">/hr</span></div>
            </div>
            <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase">10th Std</div>
              <div className="font-black text-white mt-0.5">₹500 – ₹550<span className="text-[10px] font-normal text-slate-400">/hr</span></div>
            </div>
            <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase">11th Std</div>
              <div className="font-black text-teal-300 mt-0.5">₹600<span className="text-[10px] font-normal text-slate-400">/hr</span></div>
            </div>
            <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase">12th / NEET</div>
              <div className="font-black text-purple-300 mt-0.5">₹700 – ₹750<span className="text-[10px] font-normal text-slate-400">/hr</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Tabs with MobileTabs */}
      <MobileTabs
        tabs={[
          {
            id: "inbox",
            label: "Pending Attendance",
            icon: Clock,
            count: missingSessions.length,
          },
          {
            id: "history",
            label: "Completed Classes & Trainer Earnings",
            icon: History,
            count: allRecords.length,
          },
          {
            id: "absences",
            label: "Teacher Absences",
            icon: ShieldAlert,
            count: teacherAbsences.length,
          },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Missing Attendance Inbox with Quick 1-Click Marking */}
      {activeTab === "inbox" && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Classes Awaiting Attendance ({missingSessions.length})
            </span>
            <span className="text-xs text-slate-400">
              Click &ldquo;⚡ Quick Mark Done&rdquo; or &ldquo;Full Form&rdquo;
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {missingSessions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-10 w-10 text-teal-400 mx-auto mb-3" />
                All classes are up-to-date! No pending attendance.
              </div>
            ) : (
              missingSessions.map((ses) => {
                const hourlyRate: number | null = ses.hourlyRate ?? null;
                const standard1HourEarning = hourlyRate;

                return (
                  <div
                    key={ses.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className="w-2.5 h-14 rounded-full mt-0.5 shrink-0 shadow-sm"
                        style={{ backgroundColor: ses.subject.color }}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-white">
                            {ses.student.name}
                          </span>
                          <span className="rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2.5 py-0.5 text-xs font-bold">
                            {ses.student.grade} ({ses.student.board})
                          </span>
                          <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-xs font-bold text-teal-300">
                            {ses.subject.name}
                          </span>
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            Attendance Pending
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>Trainer: <strong className="text-slate-200">{ses.teacher.name}</strong></span>
                          <span>•</span>
                          <span>
                            Class Date: {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                          </span>
                        </div>

                        {/* Standard-specific rate tag (only for roles allowed to see pay rates) */}
                        {hourlyRate !== null && (
                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-bold text-emerald-300 text-[11px]">
                            <DollarSign className="h-3 w-3 text-emerald-400" />
                            Standard Rate: ₹{hourlyRate}/hr
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (1 hr class = ₹{standard1HourEarning} trainer earnings)
                          </span>
                        </div>
                        )}
                      </div>
                    </div>

                    {/* Simple 1-Click Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleQuickMarkDone(ses)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:from-teal-300 hover:to-emerald-400 shadow-md transition-all disabled:opacity-50"
                        title="Mark class completed and student present in 1 click"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Present
                      </button>

                      <button
                        onClick={() => handleQuickMarkAbsent(ses)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition-all disabled:opacity-50"
                        title="Mark student absent"
                      >
                        <X className="h-4 w-4" />
                        Absent
                      </button>

                      <button
                        onClick={() => {
                          setSubmitSession(ses);
                          setDuration("60");
                          setTopic(`Regular ${ses.subject.name} class session`);
                          setHomework("");
                          setProgressNote("");
                          setErrorMsg("");
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                        title="Add homework or custom notes"
                      >
                        Notes / Custom
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Attendance History & Trainer Earnings */}
      {activeTab === "history" && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Completed Classes & Earnings ({allRecords.length})
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {allRecords.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <History className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                No attendance records marked yet.
              </div>
            ) : (
              allRecords.map((rec) => {
                const studentGrade = rec.session.student.grade;
                const rate: number | null = rec.hourlyRate ?? null;
                const durationMins = rec.actualDurationMinutes || 60;
                const earned = rec.sessionOutcome === "COMPLETED" && rate !== null
                  ? calculateTrainerEarnings(rate, durationMins)
                  : 0;

                return (
                  <div
                    key={rec.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-white text-sm">
                          {rec.session.student.name}
                        </span>
                        <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                          {studentGrade}
                        </span>
                        <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2.5 py-0.5 text-[10px] font-bold text-teal-300">
                          {rec.session.subject.name}
                        </span>
                        <StatusBadge status={rec.sessionOutcome} size="sm" />
                        {rec.isReversed && (
                          <StatusBadge status="REVERSED" size="sm" />
                        )}
                      </div>

                      <div className="text-slate-300">
                        <strong className="text-slate-400">Topic:</strong> {rec.topicCovered}
                      </div>

                      <div className="text-slate-400 text-[11px]">
                        Trainer: <strong className="text-slate-200">{rec.session.teacher.name}</strong> • Marked: {formatInTimeZone(rec.markedAt, "Asia/Kolkata")}
                      </div>
                    </div>

                    {/* Right side: Trainer Earned breakdown */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                      {rate !== null && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          Trainer Earned
                        </span>
                        <div className="font-black text-sm text-emerald-400">
                          ₹{earned.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Rate: ₹{rate}/hr × {(durationMins / 60).toFixed(1)} hrs
                        </div>
                      </div>
                      )}

                      {/* Correction trigger */}
                      {canCorrect && (
                        <button
                          onClick={() => {
                            setCorrectingRecord(rec);
                            setNewOutcome(rec.sessionOutcome);
                            setNewAttendance(rec.studentAttendance);
                            setCorrectionReason("");
                            setErrorMsg("");
                          }}
                          className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          Correction
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Teacher Absences */}
      {activeTab === "absences" && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl shadow-black/40 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs bg-amber-950/40 p-3.5 rounded-2xl border border-amber-500/30">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            Mandatory Business Policy: Teacher absence NEVER consumes student package credits.
          </div>
          <div className="divide-y divide-slate-800/60">
            {teacherAbsences.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Zero teacher absences recorded.
              </div>
            ) : (
              teacherAbsences.map((rec) => (
                <div key={rec.id} className="py-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{rec.session.teacher.name} • {rec.session.subject.name} with {rec.session.student.name}</span>
                    <span className="text-rose-400 font-semibold">Credit Consumed: 0 (Protected)</span>
                  </div>
                  <div className="text-slate-400">
                    Note: {rec.topicCovered}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Attendance Modal with Live Earnings Calculator */}
      {submitSession && (
        <div className="fixed inset-0 z-50 modal-overlay bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#0c1220] p-6 shadow-2xl border border-slate-800 my-8 text-white">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-extrabold text-white">
                  Mark Class Attendance & Earnings
                </h3>
              </div>
              <button
                onClick={() => setSubmitSession(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAttendanceSubmit} className="mt-4 space-y-4 text-xs">
              {/* Student Standard & Trainer Info */}
              <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-sm">
                    {submitSession.student.name}
                  </span>
                  <span className="rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2.5 py-0.5 text-xs font-bold">
                    {submitSession.student.grade} ({submitSession.student.board})
                  </span>
                </div>
                <div className="text-slate-400">
                  Subject: <strong className="text-slate-200">{submitSession.subject.name}</strong> • Tutor: <strong className="text-slate-200">{submitSession.teacher.name}</strong>
                </div>
              </div>

              {/* LIVE TRAINER EARNINGS CALCULATOR BOX (only for roles allowed to see pay rates) */}
              {modalHourlyRate !== null && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>Trainer Earnings for this Class:</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    ₹{modalTrainerEarnings.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-300/80 pt-1 border-t border-emerald-500/20">
                  <span>Standard Rate: <strong>₹{modalHourlyRate}/hr</strong></span>
                  <span>Hours Taught: <strong>{modalDurationHours} hrs</strong> ({modalDurationMins} mins)</span>
                </div>
              </div>
              )}

              {/* Duration Buttons (30m, 45m, 60m, 90m, 120m) */}
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1.5">
                  Class Duration in Hours / Minutes *
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "45 Mins (0.75h)", mins: "45" },
                    { label: "60 Mins (1.0h)", mins: "60" },
                    { label: "90 Mins (1.5h)", mins: "90" },
                    { label: "120 Mins (2.0h)", mins: "120" },
                  ].map((dur) => (
                    <button
                      key={dur.mins}
                      type="button"
                      onClick={() => setDuration(dur.mins)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        duration === dur.mins
                          ? "bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950 font-black shadow-md"
                          : "bg-slate-850 text-slate-300 border border-slate-750 hover:bg-slate-800"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="15"
                    max="240"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Custom mins"
                    className="w-24 rounded-xl border border-slate-700 bg-slate-850 px-2.5 py-1.5 text-white text-center font-bold text-xs"
                  />
                </div>
              </div>

              {/* Session Outcome & Student Attendance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Outcome *
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-850 p-2.5 font-medium text-white focus:outline-hidden"
                  >
                    <option value="COMPLETED" className="bg-slate-900">Completed (Deducts 1 Credit)</option>
                    <option value="STUDENT_NO_SHOW" className="bg-slate-900">Student No-Show</option>
                    <option value="TEACHER_NO_SHOW" className="bg-slate-900">Teacher No-Show (0 Charge)</option>
                    <option value="CANCELLED" className="bg-slate-900">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Attendance *
                  </label>
                  <select
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-850 p-2.5 font-medium text-white focus:outline-hidden"
                  >
                    <option value="PRESENT" className="bg-slate-900">Present</option>
                    <option value="LATE" className="bg-slate-900">Late</option>
                    <option value="ABSENT" className="bg-slate-900">Absent</option>
                  </select>
                </div>
              </div>

              {/* Topic with Quick Prefill */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300 uppercase">
                    Topic Covered *
                  </label>
                  <button
                    type="button"
                    onClick={() => setTopic("Curriculum Syllabus & Practice Questions")}
                    className="text-[11px] text-teal-400 font-bold hover:underline"
                  >
                    + Auto-fill Standard Topic
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Thermodynamics and Enthalpy Calculations"
                  className="w-full rounded-xl border border-slate-700 bg-slate-850 p-2.5 text-white font-medium focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Homework Assigned (Optional)
                </label>
                <input
                  type="text"
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="e.g. NCERT Page 88 Questions 1-5"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              {/* EXPLICIT POLICY CREDIT EFFECT BANNER */}
              <div
                className={`rounded-xl p-3.5 border text-xs ${
                  outcome === "COMPLETED"
                    ? "bg-teal-50 border-teal-200 text-teal-900"
                    : outcome === "TEACHER_NO_SHOW"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    {outcome === "COMPLETED"
                      ? "Credit Policy: Consumes 1 class credit from student's active package."
                      : outcome === "TEACHER_NO_SHOW"
                      ? "Protected Policy: Teacher absence NEVER deducts student credit."
                      : outcome === "STUDENT_NO_SHOW"
                      ? "Notice Policy: Deducts 1 class credit per student no-show rules."
                      : "Cancellation Policy: Evaluates notice period before deducting."}
                  </span>
                </div>
                <div className="mt-1 text-[11px] opacity-90">
                  {outcome === "COMPLETED"
                    ? modalHourlyRate !== null
                      ? `Trainer earns ₹${modalTrainerEarnings} (Standard Rate: ₹${modalHourlyRate}/hr × ${modalDurationHours}h)`
                      : "1 class credit is consumed and the trainer payout is recorded."
                    : outcome === "TEACHER_NO_SHOW"
                    ? "0 credits deducted from student package balance. Tutor replacement required."
                    : "Status will be logged in student attendance history."}
                </div>
              </div>

              {errorMsg && (
                <div role="alert" className="rounded-lg bg-rose-950/40 border border-rose-500/30 p-3 text-rose-200 font-medium flex items-center justify-between gap-2">
                  <span>{errorMsg}</span>
                  <button
                    type="submit"
                    className="underline font-bold text-rose-100 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Submit Buttons */}
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm"
                >
                  {loading ? (
                    "Processing..."
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {modalHourlyRate !== null && outcome === "COMPLETED" ? `Confirm Class (Earn ₹${modalTrainerEarnings})` : "Save Attendance"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audited Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 modal-overlay bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0c1220] p-6 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                Audited Attendance Correction
              </h3>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
                <span className="font-bold text-white">
                  {correctingRecord.session.student.name} • {correctingRecord.session.subject.name}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Previous: {correctingRecord.sessionOutcome} ({correctingRecord.studentAttendance})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    New Outcome *
                  </label>
                  <select
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 font-medium text-white focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="STUDENT_NO_SHOW">Student No-Show</option>
                    <option value="TEACHER_NO_SHOW">Teacher No-Show</option>
                    <option value="CANCELLED">Cancelled (Refunds Credit)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    New Attendance *
                  </label>
                  <select
                    value={newAttendance}
                    onChange={(e) => setNewAttendance(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 font-medium text-white focus:border-teal-500 focus:outline-hidden"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Correction Reason (Audited) *
                </label>
                <input
                  type="text"
                  required
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Medical emergency notice verified with guardian; reversed credit"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
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
                  onClick={() => setCorrectingRecord(null)}
                  className="rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-5 py-2.5 font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all active:scale-95"
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
