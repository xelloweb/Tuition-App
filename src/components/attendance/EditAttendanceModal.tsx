"use client";

import { useState, useId } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Edit2, Clock } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { controlBorder, controlClass } from "@/components/ui/Field";

export interface AttendanceRecordForEdit {
  id: string;
  studentName: string;
  subjectName: string;
  teacherName: string;
  classDate: string; // ISO or date string
  durationMinutes: number;
  topicCovered?: string;
  homework?: string;
  studentProgressNote?: string;
}

interface EditAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  record: AttendanceRecordForEdit;
}

export function EditAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  record,
}: EditAttendanceModalProps) {
  const fieldId = useId();
  const initialHours = record.durationMinutes / 60;
  const initialOpt = [1, 2, 3].includes(initialHours) ? String(initialHours) : "custom";

  const [durationOption, setDurationOption] = useState<"1" | "2" | "3" | "custom">(initialOpt as any);
  const [customHours, setCustomHours] = useState(String(initialHours));
  const [topicCovered, setTopicCovered] = useState(record.topicCovered || "");
  const [homework, setHomework] = useState(record.homework || "");
  const [studentProgressNote, setStudentProgressNote] = useState(record.studentProgressNote || "");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const computedDurationMinutes =
    durationOption === "custom"
      ? Math.max(15, Math.round((parseFloat(customHours) || 1) * 60))
      : parseInt(durationOption, 10) * 60;

  const computedCredits = Math.max(1, Math.round(computedDurationMinutes / 60));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      await apiRequest(`/api/attendance/${record.id}`, {
        method: "PATCH",
        body: {
          durationMinutes: computedDurationMinutes,
          topicCovered: topicCovered.trim() || undefined,
          homework: homework.trim() || undefined,
          studentProgressNote: studentProgressNote.trim() || undefined,
          reason: reason.trim() || undefined,
        },
      });

      onSuccess("Attendance updated successfully. Package balance and trainer hours have been automatically corrected.");
      onClose();
    } catch (err: any) {
      setErrorMsg(errorMessage(err, "Failed to update attendance."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      labelledBy="edit-attendance-title"
      onClose={onClose}
      closeDisabled={loading}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Edit2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="edit-attendance-title" className="text-lg font-bold text-ink">
                Edit Attendance Record
              </h2>
              <p className="text-sm text-ink-muted break-words">
                {record.studentName} · {record.subjectName} · {record.teacherName}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-danger flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Duration Selection */}
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

        {/* Note about auto recalculations */}
        <div className="rounded-xl bg-raised/60 border border-line p-3 text-sm text-ink-muted">
          <p>
            ℹ️ Changing duration automatically corrects the student&apos;s package balance, completed class hours, trainer working hours, and salary calculation without duplicate deductions.
          </p>
        </div>

        {/* Topic Covered */}
        <div>
          <label htmlFor={`${fieldId}-topic`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Topic Covered
          </label>
          <input
            id={`${fieldId}-topic`}
            type="text"
            value={topicCovered}
            onChange={(e) => setTopicCovered(e.target.value)}
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Homework */}
        <div>
          <label htmlFor={`${fieldId}-homework`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Homework (Optional)
          </label>
          <input
            id={`${fieldId}-homework`}
            type="text"
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Trainer Progress Note */}
        <div>
          <label htmlFor={`${fieldId}-note`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Trainer / Class Note (Optional)
          </label>
          <textarea
            id={`${fieldId}-note`}
            rows={2}
            value={studentProgressNote}
            onChange={(e) => setStudentProgressNote(e.target.value)}
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Reason for edit */}
        <div>
          <label htmlFor={`${fieldId}-reason`} className="mb-1 block text-sm font-semibold text-ink-muted">
            Reason for Change (Audit Log)
          </label>
          <input
            id={`${fieldId}-reason`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Corrected 1 hour to 2 hours completed"
            className={`${controlClass} ${controlBorder(false)}`}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} variant="primary">
            Save Changes
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
