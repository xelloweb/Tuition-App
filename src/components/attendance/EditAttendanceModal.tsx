"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Edit2, Clock } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";

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
              <h2 id="edit-attendance-title" className="text-lg font-bold text-white">
                Edit Attendance Record
              </h2>
              <p className="text-xs text-slate-400">
                {record.studentName} · {record.subjectName} · {record.teacherName}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Duration Selection */}
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

        {/* Note about auto recalculations */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 text-xs text-slate-300">
          <p>
            ℹ️ Changing duration automatically corrects the student&apos;s package balance, completed class hours, trainer working hours, and salary calculation without duplicate deductions.
          </p>
        </div>

        {/* Topic Covered */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Topic Covered
          </label>
          <input
            type="text"
            value={topicCovered}
            onChange={(e) => setTopicCovered(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Homework */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Homework (Optional)
          </label>
          <input
            type="text"
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Trainer Progress Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Trainer / Class Note (Optional)
          </label>
          <textarea
            rows={2}
            value={studentProgressNote}
            onChange={(e) => setStudentProgressNote(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Reason for edit */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Reason for Change (Audit Log)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Corrected 1 hour to 2 hours completed"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
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
