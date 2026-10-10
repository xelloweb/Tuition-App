"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Trash2, X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatDateOnly } from "@/lib/timezones";
import type { AutoPackage, AutoPackageReview } from "@/lib/services/auto-package-cleanup";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ORIGIN = { IMPORT: "Created by the 8 Oct student import", EDIT_FORM: "Created automatically when the student was edited" } as const;

function moneyLine(p: AutoPackage) {
  if (!p.invoice) return "No invoice.";
  return p.invoice.action === "UNLINK"
    ? `Paid invoice ${p.invoice.invoiceNumber} (${rupees(p.invoice.paidAmount)}) stays, ready to assign.`
    : `Its invoice ${p.invoice.invoiceNumber} is removed; the ${rupees(p.invoice.paidAmount)} paid becomes unused again.`;
}

/**
 * Owner-only: lists packages created automatically from payment records, with
 * what removing each does, asks for the backup, then removes them all.
 */
export function AutoPackageCleanupDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [review, setReview] = useState<AutoPackageReview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ message: string; noActivePackage: number; skipped: { packageNumber: string; reason: string }[] } | null>(null);

  useEffect(() => {
    apiRequest<AutoPackageReview>("/api/packages/auto-created")
      .then(setReview)
      .catch((err) => setLoadError(errorMessage(err, "Could not load the packages.")));
  }, []);

  const count = review?.removable.length ?? 0;
  const canRemove = count > 0 && downloaded && confirm.trim().toUpperCase() === "REMOVE";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRemove || saving) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const res = await apiRequest<{ message: string; noActivePackage: number; skipped: { packageNumber: string; reason: string }[] }>("/api/packages/auto-created", {
        method: "POST",
        body: { confirm: confirm.trim() },
      });
      setDone(res);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Nothing was removed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell labelledBy="auto-pkg-title" onClose={done ? onDone : onClose} closeDisabled={saving} maxWidth="max-w-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="auto-pkg-title" className="text-lg font-bold text-ink">Remove automatically created packages</h2>
            <p className="text-sm text-ink-muted">Payments are never changed. Afterwards, assign the right package with “Assign Package Using Existing Payment”.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={done ? onDone : onClose}
          disabled={saving}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {done ? (
        <div className="mt-4 space-y-3 text-sm">
          <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-ink">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            {done.message}
          </p>
          {done.noActivePackage > 0 && (
            <p className="text-ink-muted">{done.noActivePackage} student(s) now show “No Active Package” and appear under “Paid, package not set up”.</p>
          )}
          {done.skipped.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-warning">
              {done.skipped.map((s) => <li key={s.packageNumber}>{s.packageNumber}: {s.reason}</li>)}
            </ul>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={onDone}>Done</Button>
          </div>
        </div>
      ) : loadError ? (
        <p role="alert" className="mt-4 text-sm text-danger">{loadError}</p>
      ) : !review ? (
        <p className="mt-4 text-sm text-ink-muted">Checking every package…</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 text-sm">
          <section aria-labelledby="auto-remove-h" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <h3 id="auto-remove-h" className="font-semibold text-ink">Will be removed ({count})</h3>
            {count === 0 ? (
              <p className="mt-1 text-ink-muted">No automatically created package can be removed.</p>
            ) : (
              <>
                <p className="mt-1 text-ink-muted">
                  For each: the package, its subject allocations and credit history, and booked classes never attended. Weekly timetables, trainers,
                  attendance and payments stay.
                </p>
                <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {review.removable.map((p) => (
                    <li key={p.packageId} className="rounded-lg border border-line bg-surface p-2.5">
                      <p className="font-semibold text-ink break-words">
                        {p.student.name} <span className="font-mono text-ink-muted">({p.student.studentCode})</span>
                      </p>
                      <p className="text-ink-muted">
                        <span className="font-mono">{p.packageNumber}</span> · {ORIGIN[p.origin]} on {formatDateOnly(p.createdAt)}
                      </p>
                      <p className="text-ink-muted">
                        {moneyLine(p)} {p.bookedClasses ? `${p.bookedClasses} booked class${p.bookedClasses === 1 ? "" : "es"} removed.` : ""}
                        {p.onlyPackage ? " Will show “No Active Package”." : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {review.kept.length > 0 && (
            <details className="rounded-xl border border-line bg-raised p-3">
              <summary className="cursor-pointer font-semibold text-ink">Kept ({review.kept.length}): created automatically but not safe to remove here</summary>
              <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1 text-ink-muted">
                {review.kept.map((p) => (
                  <li key={p.packageId}>
                    <span className="text-ink">{p.student.name}</span> ({p.student.studentCode}) · <span className="font-mono">{p.packageNumber}</span>: {p.keepReason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {count > 0 && (
            <>
              <div className="space-y-2">
                <p className="font-semibold text-ink">Step 1: download the backup</p>
                <a
                  href="/api/packages/auto-created?backup=1"
                  download
                  onClick={() => setDownloaded(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong bg-raised px-4 py-2 font-semibold text-ink hover:bg-surface"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {downloaded ? "Backup downloaded (download again)" : "Download backup file"}
                </a>
              </div>
              <Field label="Step 2: type REMOVE to confirm" required error={fieldErrors.confirm}>
                {(fp) => (
                  <input
                    {...fp}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={!downloaded}
                    autoComplete="off"
                    autoCapitalize="characters"
                    className={`${controlClass} ${controlBorder(!!fieldErrors.confirm)} font-mono`}
                  />
                )}
              </Field>
            </>
          )}

          {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-medium text-danger">{error}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" icon={Trash2} loading={saving} disabled={!canRemove}>
              Remove {count} package{count === 1 ? "" : "s"}
            </Button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
