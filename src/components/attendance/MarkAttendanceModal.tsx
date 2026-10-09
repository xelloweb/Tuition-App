"use client";

import { useState, useEffect, useId } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, CheckCircle2, Clock, Calendar, BookOpen, User, Sparkles } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { controlBorder, controlClass } from "@/components/ui/Field";

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
  const fieldId = useId();
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
  // Either prop spelling (the trainer screens pass `preselectedStudent`) selects the student.
  const currentStudent = activePreStudent?.id === studentId
    ? activePreStudent
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
        <div className="border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-text">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="mark-attendance-title" className="text-lg font-bold text-ink">
                Mark Attendance
              </h2>
              <p className="text-sm text-ink-muted">
                Confirm completed class hours. Package credits will deduct automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-danger flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Warning Notice */}
        {warningMsg && (
          <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-warning space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{warningMsg}</span>
            </div>
            <label className="flex min-h-[44px] items-center gap-3 font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={confirmExceedsCredits || confirmDuplicate}
                onChange={(e) => {
                  setConfirmExceedsCredits(e.target.checked);
                  setConfirmDuplicate(e.target.checked);
                }}
                className="h-5 w-5 shrink-0 rounded border-line-strong bg-raised accent-teal-400"
              />
              <span>I confirm and want to submit this attendance</span>
            </label>
          </div>
        )}

        {/* Student Selection */}
        <div>
          <label htmlFor={`${fieldId}-student`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Student Name
          </label>
          {activePreStudent ? (
            <div id={`${fieldId}-student`} className="flex min-h-[44px] items-center justify-between gap-2 rounded-control border border-line-strong bg-raised px-3 py-2.5 text-base font-bold text-ink sm:text-sm">
              <span className="min-w-0 break-words">{activePreStudent.name}</span>
              {activePreStudent.grade && (
                <span className="shrink-0 text-sm text-ink-muted font-normal">
                  {activePreStudent.grade}
                </span>
              )}
            </div>
          ) : (
            <select
              id={`${fieldId}-student`}
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className={`${controlClass} ${controlBorder(false)}`}
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
          <label htmlFor={`${fieldId}-subject`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Subject
          </label>
          <select
            id={`${fieldId}-subject`}
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className={`${controlClass} ${controlBorder(false)}`}
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
            <label htmlFor={`${fieldId}-trainer`} className="mb-1 block text-sm font-semibold text-ink-muted">
              Assigned Trainer
            </label>
            <select
              id={`${fieldId}-trainer`}
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={`${controlClass} ${controlBorder(false)}`}
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
          <label htmlFor={`${fieldId}-date`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Class Date (IST)
          </label>
          <input
            id={`${fieldId}-date`}
            type="date"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            className={`${controlClass} ${controlBorder(false)}`}
            required
          />
        </div>

        {/* Class Duration Dropdown */}
        <div>
          <p id={`${fieldId}-duration`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Class Duration
          </p>
          <div role="group" aria-labelledby={`${fieldId}-duration`} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                aria-pressed={durationOption === opt.val}
                className={`flex min-h-[52px] flex-col items-center justify-center p-2.5 rounded-xl border text-sm font-bold transition-all ${
                  durationOption === opt.val
                    ? "border-brand bg-brand/10 text-brand-text shadow-md shadow-teal-500/10"
                    : "border-line bg-raised/60 text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-xs font-normal text-ink-muted mt-0.5">
                  {opt.val === "custom" ? "Specify hrs" : opt.credits}
                </span>
              </button>
            ))}
          </div>

          {durationOption === "custom" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-raised/60 border border-line p-2.5">
              <Clock className="h-4 w-4 text-brand-text shrink-0" aria-hidden="true" />
              <input
                aria-label="Custom class hours"
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                inputMode="decimal"
                className={`w-24 min-h-[44px] rounded-control border bg-canvas px-2.5 py-2 text-base font-bold text-ink text-center focus:outline-none focus:ring-2 focus:ring-brand/60 sm:text-sm ${controlBorder(false)}`}
                placeholder="Hours"
                required
              />
              <span className="text-sm text-ink-muted">
                Hour(s) = <strong className="text-ink">{computedCredits} Class Credit(s)</strong>
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Credit Calculation Note */}
        <div className="rounded-xl bg-raised/60 border border-line p-3 text-sm text-ink-muted flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span>Automatic Package Credit Deduction:</span>
          <span className="font-bold text-brand-text tabular-nums">
            {computedCredits} Credit{computedCredits > 1 ? "s" : ""}
          </span>
        </div>

        {/* Topic Covered (Optional) */}
        <div>
          <label htmlFor={`${fieldId}-topic`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Topic Covered (Optional)
          </label>
          <input
            id={`${fieldId}-topic`}
            type="text"
            value={topicCovered}
            onChange={(e) => setTopicCovered(e.target.value)}
            placeholder="e.g. Quadratic Equations, Chapter 4 revision"
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Progress / Trainer Note (Optional) */}
        <div>
          <label htmlFor={`${fieldId}-note`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Trainer / Class Note (Optional)
          </label>
          <textarea
            id={`${fieldId}-note`}
            rows={2}
            value={studentProgressNote}
            onChange={(e) => setStudentProgressNote(e.target.value)}
            placeholder="e.g. Student understood concepts well, homework assigned"
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
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
