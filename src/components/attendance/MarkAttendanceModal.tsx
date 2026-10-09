"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, Clock, Calendar, BookOpen, User, Sparkles } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";

export interface StudentOption {
  id: string;
  name: string;
  grade?: string;
  assignedSubjects: { id: string; name: string; teacherId?: string | null; teacherName?: string | null }[];
}

export interface TrainerOption {
  id: string;
  name: string;
}

interface MarkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  // If pre-selected (e.g. from Trainer Portal "My Students" or Student Detail page)
  preSelectedStudent?: {
    id: string;
    name: string;
    grade?: string;
    assignedSubjects: { id: string; name: string; teacherId?: string | null; teacherName?: string | null }[];
  } | null;
  preselectedStudent?: {
    id: string;
    name: string;
    grade?: string;
    assignedSubjects: { id: string; name: string; teacherId?: string | null; teacherName?: string | null }[];
  } | null;
  preSelectedSubject?: { id: string; name: string } | null;
  preselectedSubject?: { id: string; name: string } | null;
  // For staff selector
  allStudents?: StudentOption[];
  allTrainers?: TrainerOption[];
  // If current user is a trainer
  isTrainer?: boolean;
  currentTrainerId?: string;
  currentTrainerName?: string;
}

export function MarkAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedStudent,
  preselectedStudent,
  preSelectedSubject,
  preselectedSubject,
  allStudents = [],
  allTrainers = [],
  isTrainer = false,
  currentTrainerId,
  currentTrainerName,
}: MarkAttendanceModalProps) {
  const activePreStudent = preSelectedStudent || preselectedStudent;
  const activePreSubject = preSelectedSubject || preselectedSubject;

  // Today's date in IST format YYYY-MM-DD
  const getTodayIst = () => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };

  const [studentId, setStudentId] = useState(activePreStudent?.id ?? "");
  const [subjectId, setSubjectId] = useState(activePreSubject?.id ?? "");
  const [teacherId, setTeacherId] = useState(currentTrainerId ?? "");
  const [classDate, setClassDate] = useState(getTodayIst());
  const [durationOption, setDurationOption] = useState<"1" | "2" | "3" | "custom">("1");
  const [customHours, setCustomHours] = useState("1");
  const [topicCovered, setTopicCovered] = useState("");
  const [homework, setHomework] = useState("");
  const [studentProgressNote, setStudentProgressNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [confirmExceedsCredits, setConfirmExceedsCredits] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  // Sync state if preSelectedStudent changes
  useEffect(() => {
    if (activePreStudent) {
      setStudentId(activePreStudent.id);
      if (activePreSubject) {
        setSubjectId(activePreSubject.id);
      } else if (activePreStudent.assignedSubjects.length > 0) {
        setSubjectId(activePreStudent.assignedSubjects[0].id);
      }
      if (!isTrainer && activePreStudent.assignedSubjects[0]?.teacherId) {
        setTeacherId(activePreStudent.assignedSubjects[0].teacherId);
      }
    } else if (allStudents.length > 0 && !studentId) {
      setStudentId(allStudents[0].id);
    }
  }, [activePreStudent, activePreSubject, allStudents]);

  // Find active student object
  const currentStudent = preSelectedStudent?.id === studentId
    ? preSelectedStudent
    : allStudents.find((s) => s.id === studentId);

  // Available subjects for selected student
  const availableSubjects = currentStudent?.assignedSubjects ?? [];

  // When student changes, update subject and teacher
  const handleStudentChange = (newStudentId: string) => {
    setStudentId(newStudentId);
    setErrorMsg("");
    setWarningMsg("");
    const stud = allStudents.find((s) => s.id === newStudentId);
    if (stud && stud.assignedSubjects.length > 0) {
      setSubjectId(stud.assignedSubjects[0].id);
      if (!isTrainer && stud.assignedSubjects[0].teacherId) {
        setTeacherId(stud.assignedSubjects[0].teacherId);
      }
    } else {
      setSubjectId("");
    }
  };

  // When subject changes, update teacher if staff
  const handleSubjectChange = (newSubId: string) => {
    setSubjectId(newSubId);
    setErrorMsg("");
    setWarningMsg("");
    if (!isTrainer && currentStudent) {
      const match = currentStudent.assignedSubjects.find((s) => s.id === newSubId);
      if (match?.teacherId) {
        setTeacherId(match.teacherId);
      }
    }
  };

  if (!isOpen) return null;

  // Calculate duration in minutes and credits
  const computedDurationMinutes =
    durationOption === "custom"
      ? Math.max(15, Math.round((parseFloat(customHours) || 1) * 60))
      : parseInt(durationOption, 10) * 60;

  const computedCredits = Math.max(1, Math.round(computedDurationMinutes / 60));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setErrorMsg("Please select a student.");
      return;
    }
    if (!subjectId) {
      setErrorMsg("Please select a subject.");
      return;
    }
    if (!classDate) {
      setErrorMsg("Please select a class date.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const payload = {
        studentId,
        subjectId,
        teacherId: isTrainer ? currentTrainerId : teacherId,
        classDate,
        durationMinutes: computedDurationMinutes,
        topicCovered: topicCovered || "Class completed",
        homework: homework || undefined,
        studentProgressNote: studentProgressNote || undefined,
        confirmExceedsCredits,
        confirmDuplicate,
      };

      const res = await apiRequest<{ message: string; creditsDeducted: number }>(
        "/api/attendance",
        {
          method: "POST",
          body: payload,
        }
      );

      onSuccess(res.message || `Attendance successfully recorded (${res.creditsDeducted} credit(s) deducted).`);
      onClose();
    } catch (err: any) {
      if (err?.code === "EXCEEDS_PACKAGE_CREDITS") {
        setWarningMsg(err.message);
      } else if (err?.code === "DUPLICATE_ATTENDANCE") {
        setWarningMsg(err.message);
      } else {
        setErrorMsg(errorMessage(err, "Failed to submit attendance."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      labelledBy="mark-attendance-title"
      onClose={onClose}
      closeDisabled={loading}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header */}
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="mark-attendance-title" className="text-lg font-bold text-white">
                Mark Attendance
              </h2>
              <p className="text-xs text-slate-400">
                Confirm completed class hours. Package credits will deduct automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Warning Notice */}
        {warningMsg && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{warningMsg}</span>
            </div>
            <label className="flex items-center gap-2 font-semibold text-white cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmExceedsCredits || confirmDuplicate}
                onChange={(e) => {
                  setConfirmExceedsCredits(e.target.checked);
                  setConfirmDuplicate(e.target.checked);
                }}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-teal-400"
              />
              <span>I confirm and want to submit this attendance</span>
            </label>
          </div>
        )}

        {/* Student Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Student Name
          </label>
          {preSelectedStudent ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-white">
              <span>{preSelectedStudent.name}</span>
              {preSelectedStudent.grade && (
                <span className="text-xs text-slate-400 font-normal">
                  {preSelectedStudent.grade}
                </span>
              )}
            </div>
          ) : (
            <select
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
              required
            >
              <option value="">Select Student</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.grade ? `(${s.grade})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Subject Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Subject
          </label>
          <select
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
            required
          >
            {availableSubjects.length === 0 ? (
              <option value="">No assigned subjects</option>
            ) : (
              availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Trainer (for staff only; trainers see their own name) */}
        {!isTrainer && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Assigned Trainer
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
              required
            >
              <option value="">Select Trainer</option>
              {allTrainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Class Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Class Date (IST)
          </label>
          <input
            type="date"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-teal-400 focus:outline-none"
            required
          />
        </div>

        {/* Class Duration Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Class Duration
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { val: "1", label: "1 Hour", credits: "1 Credit" },
              { val: "2", label: "2 Hours", credits: "2 Credits" },
              { val: "3", label: "3 Hours", credits: "3 Credits" },
              { val: "custom", label: "Custom", credits: "Hours" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setDurationOption(opt.val as any)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  durationOption === opt.val
                    ? "border-teal-400 bg-teal-500/10 text-teal-300 shadow-md shadow-teal-500/10"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] font-normal text-slate-400 mt-0.5">
                  {opt.val === "custom" ? "Specify hrs" : opt.credits}
                </span>
              </button>
            ))}
          </div>

          {durationOption === "custom" && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 p-2.5">
              <Clock className="h-4 w-4 text-teal-400 shrink-0" />
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-sm font-bold text-white text-center focus:border-teal-400 focus:outline-none"
                placeholder="Hours"
                required
              />
              <span className="text-xs text-slate-300">
                Hour(s) = <strong>{computedCredits} Class Credit(s)</strong>
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Credit Calculation Note */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-xs text-slate-300 flex items-center justify-between">
          <span>Automatic Package Credit Deduction:</span>
          <span className="font-bold text-teal-300">
            {computedCredits} Credit{computedCredits > 1 ? "s" : ""}
          </span>
        </div>

        {/* Topic Covered (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Topic Covered (Optional)
          </label>
          <input
            type="text"
            value={topicCovered}
            onChange={(e) => setTopicCovered(e.target.value)}
            placeholder="e.g. Quadratic Equations, Chapter 4 revision"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Progress / Trainer Note (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Trainer / Class Note (Optional)
          </label>
          <textarea
            rows={2}
            value={studentProgressNote}
            onChange={(e) => setStudentProgressNote(e.target.value)}
            placeholder="e.g. Student understood concepts well, homework assigned"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} variant="primary">
            Submit Attendance
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
