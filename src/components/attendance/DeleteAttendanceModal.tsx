"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";

interface DeleteAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  record: {
    id: string;
    studentName: string;
    subjectName: string;
    teacherName: string;
    durationMinutes: number;
    hoursCompleted?: number;
  };
}

export function DeleteAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  record,
}: DeleteAttendanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const hours = record.hoursCompleted ?? record.durationMinutes / 60;
  const credits = Math.max(1, Math.round(hours));

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await apiRequest<{ message: string }>(`/api/attendance/${record.id}`, {
        method: "DELETE",
      });

      onSuccess(res.message || "Attendance record deleted. Package credits and trainer hours have been restored.");
      onClose();
    } catch (err: any) {
      setErrorMsg(errorMessage(err, "Failed to delete attendance record."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      labelledBy="delete-attendance-title"
      onClose={onClose}
      closeDisabled={loading}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 id="delete-attendance-title" className="text-lg font-bold text-white">
              Delete Attendance Entry?
            </h2>
            <p className="text-xs text-slate-400">
              {record.studentName} · {record.subjectName} ({hours} Hour{hours > 1 ? "s" : ""})
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-200/90 space-y-2">
          <p>
            Deleting this confirmed attendance entry will automatically:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>
              Restore <strong>{credits} class credit{credits > 1 ? "s" : ""}</strong> back to the student&apos;s package.
            </li>
            <li>
              Reduce completed class hours and update remaining package balance.
            </li>
            <li>
              Reverse <strong>{hours} working hour{hours > 1 ? "s" : ""}</strong> and unpaid salary calculation for trainer <strong>{record.teacherName}</strong>.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            loading={loading}
            className="bg-rose-500 text-white hover:bg-rose-600 focus-visible:outline-rose-500"
            icon={Trash2}
          >
            Delete Attendance
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
