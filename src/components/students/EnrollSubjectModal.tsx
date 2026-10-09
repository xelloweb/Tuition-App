"use client";

import { useRef, useState } from "react";
import { X, BookOpen, RefreshCw, CheckCircle2, BookPlus } from "lucide-react";
import { QuickAddSubjectModal } from "@/components/subjects/QuickAddSubjectModal";
import { ModalShell } from "@/components/ui/ModalShell";
import { FieldError, FormErrorSummary } from "@/components/ui/FormFeedback";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { SubjectOption, TeacherOption } from "./StudentFormModal";
import { controlBorder, controlClass } from "@/components/ui/Field";

interface EnrollSubjectModalProps {
  studentId: string;
  studentName: string;
  availableSubjects: SubjectOption[];
  availableTeachers: TeacherOption[];
  currentlyEnrolledSubjectIds?: string[];
  /** When set, the modal (re)assigns the trainer for this already-enrolled subject. */
  reassign?: { subjectId: string; subjectName: string; teacherId: string | null };
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function EnrollSubjectModal({
  studentId,
  studentName,
  availableSubjects = [],
  availableTeachers = [],
  currentlyEnrolledSubjectIds = [],
  reassign,
  onClose,
  onSuccess,
}: EnrollSubjectModalProps) {
  const submittingRef = useRef(false);
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>(availableSubjects);
  const [quickSubjectModalOpen, setQuickSubjectModalOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(reassign?.subjectId ?? "");
  const [teacherId, setTeacherId] = useState(reassign?.teacherId ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activeTeachers = availableTeachers.filter((t) => t.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!subjectId) {
      setFieldErrors({ subjectId: "Choose a subject to enrol." });
      setErrorMsg("Please choose a subject.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setErrorMsg("");
    setFieldErrors({});
    try {
      const data = await apiRequest<{ message: string }>(`/api/students/${studentId}/enrolments`, {
        method: "POST",
        body: { subjectId, teacherId: teacherId || null, notes: notes.trim() || undefined },
      });
      onSuccess(data.message);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setErrorMsg(errorMessage(err, "Failed to save the enrolment."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <ModalShell labelledBy="enrol-subject-title" onClose={onClose} closeDisabled={loading || quickSubjectModalOpen} maxWidth="max-w-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-2 text-teal-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 id="enrol-subject-title" className="text-base font-bold text-white">
                {reassign ? `Assign Trainer — ${reassign.subjectName}` : "Enroll Additional Subject"}
              </h3>
              <p className="text-xs text-slate-400">Student: {studentName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-touch-target flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4 text-xs">
          <FormErrorSummary message={errorMsg} />

          {!reassign && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="enrol-subject" className="font-semibold text-slate-300">Select Subject *</label>
                <button
                  type="button"
                  onClick={() => setQuickSubjectModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors min-h-[44px]"
                >
                  <BookPlus className="h-3.5 w-3.5" />
                  Add Custom Subject
                </button>
              </div>
              <select
                id="enrol-subject"
                value={subjectId}
                aria-invalid={!!fieldErrors.subjectId}
                onChange={(e) => {
                  if (e.target.value === "__NEW__") setQuickSubjectModalOpen(true);
                  else setSubjectId(e.target.value);
                }}
                className={`${controlClass} ${controlBorder(false)} font-medium`}
              >
                <option value="">Select subject…</option>
                {subjectsList.map((sub) => {
                  const isAlready = currentlyEnrolledSubjectIds.includes(sub.id);
                  return (
                    <option key={sub.id} value={sub.id} disabled={isAlready}>
                      {sub.name} ({sub.code}) {isAlready ? "— Already Enrolled" : ""}
                    </option>
                  );
                })}
                <option value="__NEW__" className="bg-slate-800 text-teal-300 font-bold">➕ Add New Subject Manually...</option>
              </select>
              <FieldError message={fieldErrors.subjectId} />
            </div>
          )}

          <div>
            <label htmlFor="enrol-teacher" className="block font-semibold text-slate-300 mb-1">Assigned Trainer</label>
            <select
              id="enrol-teacher"
              value={teacherId}
              aria-invalid={!!fieldErrors.teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={`${controlClass} ${controlBorder(false)} font-medium`}
            >
              <option value="">Assign later (no trainer yet)</option>
              {activeTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subjects})
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.teacherId} />
            {activeTeachers.length === 0 && (
              <p className="mt-1 text-xs text-amber-300">No active trainers yet — you can enrol now and assign a trainer later.</p>
            )}
          </div>

          {!reassign && (
            <div>
              <label htmlFor="enrol-notes" className="block font-semibold text-slate-300 mb-1">Enrollment Notes (Optional)</label>
              <input
                id="enrol-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 1-on-1 focus on organic chemistry"
                className={`${controlClass} ${controlBorder(false)}`}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {reassign ? "Save Trainer" : "Confirm Enrollment"}
                </>
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      {quickSubjectModalOpen && (
        <QuickAddSubjectModal
          onClose={() => setQuickSubjectModalOpen(false)}
          onSuccess={(subject) => {
            setSubjectsList((prev) => (prev.some((s) => s.id === subject.id) ? prev : [...prev, subject]));
            setSubjectId(subject.id);
          }}
        />
      )}
    </>
  );
}
