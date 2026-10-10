"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Trash2, X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatDateOnly } from "@/lib/timezones";
import type { StudentPurgePreview } from "@/lib/services/student-purge";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`;

/**
 * Owner-only: shows exactly who and what a permanent delete removes, asks for
 * the backup file to be downloaded first, then deletes after the student code
 * is typed.
 */
export function PurgeStudentDialog({
  studentId,
  studentCode,
  onClose,
  onDeleted,
}: {
  studentId: string;
  studentCode: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<StudentPurgePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState("");

  useEffect(() => {
    apiRequest<StudentPurgePreview>(`/api/students/${studentId}/purge`)
      .then(setPreview)
      .catch((err) => setLoadError(errorMessage(err, "Could not load this student.")));
  }, [studentId]);

  const canDelete =
    preview !== null && preview.blockers.length === 0 && downloaded && confirm.trim().toUpperCase() === studentCode.toUpperCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete || saving) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const res = await apiRequest<{ message: string }>(`/api/students/${studentId}/purge`, {
        method: "POST",
        body: { confirmStudentCode: confirm.trim() },
      });
      setDone(res.message);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "The student could not be deleted. Nothing was changed."));
    } finally {
      setSaving(false);
    }
  };

  const p = preview;
  const paid = p ? p.payments.reduce((a, x) => a + x.amount, 0) : 0;

  return (
    <ModalShell labelledBy="purge-student-title" onClose={done ? onDeleted : onClose} closeDisabled={saving} maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="purge-student-title" className="text-lg font-bold text-ink">Permanently delete student</h2>
            <p className="text-sm text-ink-muted break-words">{p ? `${p.student.name} (${p.student.studentCode})` : studentCode}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={done ? onDeleted : onClose}
          disabled={saving}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {done ? (
        <div className="mt-4 space-y-4 text-sm">
          <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-ink">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            {done}
          </p>
          <p className="text-ink-muted">Keep the backup file you downloaded: it is the only way to bring these records back.</p>
          <div className="flex justify-end">
            <Button type="button" onClick={onDeleted}>Back to Students</Button>
          </div>
        </div>
      ) : loadError ? (
        <p role="alert" className="mt-4 text-sm text-danger">{loadError}</p>
      ) : !p ? (
        <p className="mt-4 text-sm text-ink-muted">Checking everything stored for this student…</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 text-sm">
          <section aria-labelledby="purge-who" className="rounded-xl border border-line bg-raised p-3">
            <h3 id="purge-who" className="font-semibold text-ink">Check this is the right student</h3>
            <dl className="mt-1 grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-0.5 text-ink-muted">
              <dt>Name</dt><dd className="text-ink break-words">{p.student.name}</dd>
              <dt>Student code</dt><dd className="font-mono text-ink">{p.student.studentCode}</dd>
              <dt>Class</dt><dd className="text-ink">{p.student.grade}</dd>
              <dt>Parent</dt><dd className="text-ink break-words">{p.student.guardianName}</dd>
              <dt>WhatsApp</dt><dd className="font-mono text-ink">{p.student.whatsappNumber}</dd>
              <dt>Added on</dt><dd className="text-ink">{formatDateOnly(p.student.createdAt)}</dd>
              <dt>Status</dt><dd className="text-ink">{p.student.status === "WITHDRAWN" ? "Archived" : p.student.status}</dd>
            </dl>
          </section>

          {p.blockers.length > 0 && (
            <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-warning">
              {p.blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          )}

          <section aria-labelledby="purge-removed" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <h3 id="purge-removed" className="font-semibold text-ink">Will be deleted permanently</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              <li>The student profile and admission details{p.other.parentForms ? `, and ${plural(p.other.parentForms, "parent form")}` : ""}.</li>
              <li>
                {p.guardian.removed
                  ? `The parent record (${p.student.guardianName}, ${p.student.whatsappNumber}). The number can then be used for a new admission.`
                  : `Not the parent record: it is also used by ${p.guardian.otherChildren.map((c) => `${c.name} (${c.studentCode})`).join(", ")}.`}
              </li>
              <li>
                {p.subjects.length
                  ? `Subjects and trainers: ${p.subjects.map((s) => `${s.subjectName} (${s.teacherName ?? "no trainer"})`).join(", ")}; ${plural(p.weeklySlots, "weekly timetable slot")}.`
                  : "No subjects."}
              </li>
              <li>{p.packages.length ? `Packages: ${p.packages.map((x) => `${x.packageNumber} (${x.totalCredits} classes)`).join(", ")}.` : "No packages."}</li>
              <li>
                Classes: {plural(p.classes.attended, "attended class")} with attendance and credit history, {plural(p.classes.upcoming, "upcoming booked class")}
                {p.classes.other ? `, ${p.classes.other} other` : ""}. They disappear from the trainers&apos; class lists and counts.
              </li>
              <li>
                {p.invoices.length
                  ? `Invoices: ${p.invoices.map((i) => `${i.invoiceNumber} (${rupees(i.totalAmount)}, ${rupees(i.paidAmount)} paid)`).join(", ")}.`
                  : "No invoices."}
              </li>
              <li>
                {p.payments.length
                  ? `Payments: ${p.payments.map((x) => `${x.paymentNumber} ${rupees(x.amount)}`).join(", ")}. Income totals in reports go down by ${rupees(paid)}.`
                  : "No payments."}
              </li>
              {p.trainerPayPending.classes > 0 && (
                <li className="text-warning">
                  Trainer pay not yet in a pay run for {plural(p.trainerPayPending.classes, "class")} ({rupees(p.trainerPayPending.amount)},{" "}
                  {p.trainerPayPending.trainers.join(", ")}). It will no longer be owed through the app.
                </li>
              )}
              {p.other.followUps + p.other.progressNotes + p.other.assessments + p.other.parentConcerns > 0 && (
                <li>
                  Also: {plural(p.other.followUps, "follow-up")}, {plural(p.other.progressNotes, "progress note")}, {plural(p.other.assessments, "assessment")},{" "}
                  {plural(p.other.parentConcerns, "parent concern")}.
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="purge-kept" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <h3 id="purge-kept" className="font-semibold text-ink">Kept</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              <li>The audit log (who did what and when), with one new entry for this deletion.</li>
              <li>All other students, trainers and their accounts.</li>
            </ul>
          </section>

          {p.blockers.length === 0 && (
            <>
              <div className="space-y-2">
                <p className="font-semibold text-ink">Step 1: download the backup</p>
                <a
                  href={`/api/students/${studentId}/purge?backup=1`}
                  download
                  onClick={() => setDownloaded(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong bg-raised px-4 py-2 font-semibold text-ink hover:bg-surface"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {downloaded ? "Backup downloaded (download again)" : "Download backup file"}
                </a>
                <p className="text-xs text-ink-subtle">
                  {p.totalRecords} records. Keep the file safe: it is needed to undo this deletion.
                </p>
              </div>
              <Field label={`Step 2: type ${studentCode} to confirm`} required error={fieldErrors.confirmStudentCode}>
                {(fp) => (
                  <input
                    {...fp}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={!downloaded}
                    autoComplete="off"
                    autoCapitalize="characters"
                    className={`${controlClass} ${controlBorder(!!fieldErrors.confirmStudentCode)} font-mono`}
                  />
                )}
              </Field>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-medium text-danger">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" icon={Trash2} loading={saving} disabled={!canDelete}>
              Delete permanently
            </Button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
