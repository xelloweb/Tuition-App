"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatInTimeZone } from "@/lib/timezones";
import type { PackageRemovalPreview } from "@/lib/services/package-removal";

/**
 * Owner-only: shows exactly what removing a wrongly created package removes and
 * keeps, then removes it after the package number is typed.
 */
export function RemovePackageDialog({
  packageId,
  packageNumber,
  onClose,
  onRemoved,
}: {
  packageId: string;
  packageNumber: string;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) {
  const [preview, setPreview] = useState<PackageRemovalPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiRequest<PackageRemovalPreview>(`/api/packages/${packageId}/removal`)
      .then((p) => {
        setPreview(p);
        if (p.moveTargets.length === 1) setMoveTo(p.moveTargets[0].id);
      })
      .catch((err) => setLoadError(errorMessage(err, "Could not load this package.")));
  }, [packageId]);

  const needsTarget = Boolean(preview?.attendedClasses.length);
  const canRemove =
    preview !== null &&
    preview.blockers.length === 0 &&
    confirm.trim().toUpperCase() === packageNumber.toUpperCase() &&
    (!needsTarget || Boolean(moveTo));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRemove || saving) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const res = await apiRequest<{ message: string }>(`/api/packages/${packageId}/removal`, {
        method: "POST",
        body: { confirmPackageNumber: confirm.trim(), moveAttendedTo: moveTo || undefined },
      });
      onRemoved(res.message);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "The package could not be removed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell labelledBy="remove-package-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="remove-package-title" className="text-lg font-bold text-ink">Remove wrongly created package</h2>
            <p className="text-sm text-ink-muted break-words">
              {packageNumber}
              {preview && ` · ${preview.package.name} · ${preview.student.name} (${preview.student.studentCode})`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {loadError ? (
        <p role="alert" className="mt-4 text-sm text-danger">{loadError}</p>
      ) : !preview ? (
        <p className="mt-4 text-sm text-ink-muted">Checking what this package holds…</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 text-sm">
          <section aria-labelledby="removed-h" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
            <h3 id="removed-h" className="font-semibold text-ink">Will be removed</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              <li>
                The package {preview.package.packageNumber} ({preview.package.totalCredits} classes) and its class allocations and balance.
              </li>
              <li>
                {preview.bookedClasses
                  ? `${preview.bookedClasses} booked class${preview.bookedClasses === 1 ? "" : "es"} that were never attended (also removed from the trainer's class list and counts).`
                  : "No booked classes."}
              </li>
              <li>
                {preview.invoices.length
                  ? `Unpaid invoice${preview.invoices.length === 1 ? "" : "s"}: ${preview.invoices.map((i) => `${i.invoiceNumber} (₹${i.totalAmount.toLocaleString("en-IN")})`).join(", ")}.`
                  : "No invoice is linked to this package."}
              </li>
            </ul>
          </section>

          <section aria-labelledby="kept-h" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <h3 id="kept-h" className="font-semibold text-ink">Kept exactly as they are</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
              <li>All of the student&apos;s payments and paid invoices.</li>
              <li>The student&apos;s other packages and weekly timetable.</li>
              {preview.attendedClasses.length > 0 && (
                <li>
                  {preview.attendedClasses.length} attended class{preview.attendedClasses.length === 1 ? "" : "es"}, moved to the package you choose:
                  <ul className="mt-1 space-y-0.5">
                    {preview.attendedClasses.map((c) => (
                      <li key={c.sessionId} className="tabular-nums">
                        {formatInTimeZone(c.start, "Asia/Kolkata")} · {c.subjectName} · {c.teacherName}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </section>

          {preview.blockers.length > 0 && (
            <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-warning">
              {preview.blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          )}

          {needsTarget && preview.moveTargets.length > 0 && (
            <Field label="Move the attended classes to" required error={fieldErrors.moveAttendedTo}>
              {(p) => (
                <select {...p} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.moveAttendedTo)}`}>
                  <option value="">Choose a package…</option>
                  {preview.moveTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.packageNumber} · {t.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {preview.blockers.length === 0 && (
            <Field label={`Type ${packageNumber} to confirm`} required error={fieldErrors.confirmPackageNumber}>
              {(p) => (
                <input
                  {...p}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className={`${controlClass} ${controlBorder(!!fieldErrors.confirmPackageNumber)} font-mono`}
                />
              )}
            </Field>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-medium text-danger">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" icon={Trash2} loading={saving} disabled={!canRemove}>
              Remove package
            </Button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
