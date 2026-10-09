"use client";

import { useMemo, useRef, useState } from "react";
import { Link2, X } from "lucide-react";
import { PACKAGE_PRESETS } from "@/lib/package-presets";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatDateOnly } from "@/lib/timezones";
import type { AssignResult, ExistingPaymentOptions } from "@/lib/services/existing-payment-packages";
import { ModalShell } from "@/components/ui/ModalShell";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const dateOnly = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "");

type Source = { key: string; type: "PACKAGE" | "INVOICE" | "PAYMENTS"; id?: string; label: string; detail: string; value: number | null; paid: number };

function split(total: number, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  ids.forEach((id, i) => {
    out[id] = String(Math.floor(total / ids.length) + (i < total % ids.length ? 1 : 0));
  });
  return out;
}

/**
 * Turns money a student has already paid into a working package. No payment
 * or extra fee is created; buying another package is the separate
 * "Purchase new package" action.
 */
export function AssignExistingPaymentDialog({
  studentId,
  options,
  onClose,
  onAssigned,
}: {
  studentId: string;
  options: ExistingPaymentOptions;
  onClose: () => void;
  onAssigned: (message: string) => void;
}) {
  const sources: Source[] = useMemo(
    () => [
      ...options.unsetPackages.map((p) => ({
        key: `PACKAGE:${p.id}`,
        type: "PACKAGE" as const,
        id: p.id,
        label: `Package ${p.packageNumber}: ${inr(p.paid)} paid`,
        detail: `${p.name}, ${p.totalCredits} classes, not yet shared between subjects${p.invoiceNumbers.length ? ` (invoice ${p.invoiceNumbers.join(", ")})` : ""}`,
        value: p.price,
        paid: p.paid,
      })),
      ...options.unlinkedInvoices.map((i) => ({
        key: `INVOICE:${i.id}`,
        type: "INVOICE" as const,
        id: i.id,
        label: `Invoice ${i.invoiceNumber}: ${inr(i.paidAmount)} paid`,
        detail: `Issued ${formatDateOnly(i.issueDate)}, not linked to any package`,
        value: i.totalAmount,
        paid: i.paidAmount,
      })),
      ...(options.unusedTotal > 0
        ? [
            {
              key: "PAYMENTS",
              type: "PAYMENTS" as const,
              label: `Unused payments: ${inr(options.unusedTotal)}`,
              detail: options.unusedPayments.map((p) => `${p.paymentNumber} (${inr(p.unused)}, received ${formatDateOnly(p.receivedDate)})`).join(", "),
              value: null,
              paid: options.unusedTotal,
            },
          ]
        : []),
    ],
    [options]
  );
  const subjectIds = options.subjects.map((s) => s.subjectId);
  const matchingPreset = PACKAGE_PRESETS.find((p) => Number(p.price) === options.unusedTotal) ?? PACKAGE_PRESETS[0];

  const initialFor = (source: Source) => {
    if (source.type === "PACKAGE") {
      const pkg = options.unsetPackages.find((p) => p.id === source.id)!;
      return { name: pkg.name, totalCredits: String(pkg.totalCredits), price: String(pkg.price), startDate: dateOnly(pkg.startDate) || todayIst(), expiryDate: dateOnly(pkg.expiryDate) };
    }
    const preset = source.type === "INVOICE" ? PACKAGE_PRESETS.find((p) => Number(p.price) === source.value) ?? PACKAGE_PRESETS[0] : matchingPreset;
    return { name: preset.name, totalCredits: preset.totalCredits, price: source.type === "INVOICE" ? String(source.value) : preset.price, startDate: todayIst(), expiryDate: "" };
  };

  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? "");
  const source = sources.find((s) => s.key === sourceKey) ?? sources[0];
  const first = initialFor(sources[0]);
  const [name, setName] = useState(first.name);
  const [totalCredits, setTotalCredits] = useState(first.totalCredits);
  const [price, setPrice] = useState(first.price);
  const [startDate, setStartDate] = useState(first.startDate);
  const [expiryDate, setExpiryDate] = useState(first.expiryDate);
  const [allocations, setAllocations] = useState<Record<string, string>>(() => split(Number(first.totalCredits) || 0, subjectIds));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const chooseSource = (key: string) => {
    const next = sources.find((s) => s.key === key);
    if (!next) return;
    const values = initialFor(next);
    setSourceKey(key);
    setName(values.name);
    setTotalCredits(values.totalCredits);
    setPrice(values.price);
    setStartDate(values.startDate);
    setExpiryDate(values.expiryDate);
    setAllocations(split(Number(values.totalCredits) || 0, subjectIds));
    setErrors({});
    setFormError("");
  };

  const applyPreset = (preset: (typeof PACKAGE_PRESETS)[number]) => {
    setName(preset.name);
    setTotalCredits(preset.totalCredits);
    if (source.type === "PAYMENTS") setPrice(preset.price);
    setAllocations(split(Number(preset.totalCredits), subjectIds));
  };

  const value = source.type === "PAYMENTS" ? Number(price) || 0 : source.value ?? 0;
  const paidFromExisting = source.type === "PAYMENTS" ? Math.min(options.unusedTotal, value) : source.paid;
  const stillToPay = Math.max(0, value - paidFromExisting);
  const allocatedTotal = subjectIds.reduce((sum, id) => sum + (Number(allocations[id]) || 0), 0);
  const ctl = (field: string) => `${controlClass} ${controlBorder(Boolean(errors[field]))}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    setErrors({});
    try {
      const data = await apiRequest<{ result: AssignResult }>(`/api/students/${studentId}/existing-payment`, {
        method: "POST",
        body: {
          source: source.type === "PAYMENTS" ? { type: "PAYMENTS" } : { type: source.type, id: source.id },
          name: name.trim() || undefined,
          totalCredits: Number(totalCredits),
          price: source.type === "PAYMENTS" ? Number(price) : undefined,
          startDate,
          expiryDate: expiryDate || null,
          allocations: subjectIds.map((subjectId) => ({ subjectId, allocatedCredits: Number(allocations[subjectId]) || 0 })),
        },
      });
      const r = data.result;
      onAssigned(
        `Package ${r.packageNumber} assigned using the existing payment: ${inr(r.paidFromExisting)} already paid, new payment created ₹0${r.stillToPay ? `, ${inr(r.stillToPay)} still to pay` : ""}.`
      );
    } catch (error) {
      setErrors(error instanceof ClientApiError ? error.fieldErrors : {});
      setFormError(errorMessage(error, "Could not assign the package."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalShell labelledBy="assign-existing-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-2xl">
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="assign-existing-title" className="text-xl font-bold text-ink">Assign package using existing payment</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {options.student.name} ({options.student.studentCode}) has already paid. This links that money to a package: no new payment or fee is created.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {formError && <Notice tone="error">{formError}</Notice>}
        {options.subjects.length === 0 && (
          <Notice tone="warning">Add this student&apos;s subjects first (Subjects tab). The package&apos;s classes are shared between them.</Notice>
        )}
        {options.unverifiedTotal > 0 && (
          <Notice tone="info">
            {inr(options.unverifiedTotal)} is recorded but not yet verified. Verify it under Invoices &amp; payments first if it should count here.
          </Notice>
        )}

        <fieldset className="space-y-2" data-field="source">
          <legend className="mb-1 text-sm font-semibold text-ink-muted">Money already paid to use</legend>
          {sources.map((s) => (
            <label key={s.key} className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 text-sm ${s.key === source.key ? "border-brand bg-brand/10" : "border-line-strong"}`}>
              <input type="radio" name="source" checked={s.key === source.key} onChange={() => chooseSource(s.key)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-400" />
              <span>
                <span className="block font-semibold text-ink">{s.label}</span>
                <span className="block text-ink-muted">{s.detail}</span>
              </span>
            </label>
          ))}
          {errors.source && <p className="text-sm font-medium text-danger">{errors.source}</p>}
        </fieldset>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink-muted">Package</p>
          <div className="flex flex-wrap gap-2">
            {PACKAGE_PRESETS.map((preset) => {
              const selected = name === preset.name && totalCredits === preset.totalCredits;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  aria-pressed={selected}
                  className={`min-h-[44px] rounded-full border px-3 text-sm font-semibold ${selected ? "border-brand bg-brand/15 text-brand-text" : "border-line-strong text-ink-muted hover:text-ink"}`}
                >
                  {preset.totalCredits} classes{source.type === "PAYMENTS" ? ` · ${inr(Number(preset.price))}` : ""}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Package name" name="name" error={errors.name} className="sm:col-span-2">
              {(p) => <input {...p} type="text" value={name} onChange={(e) => setName(e.target.value)} className={ctl("name")} />}
            </Field>
            <Field label="Total classes" name="totalCredits" required error={errors.totalCredits}>
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={totalCredits}
                  onChange={(e) => {
                    setTotalCredits(e.target.value);
                    if (Number(e.target.value) > 0) setAllocations(split(Number(e.target.value), subjectIds));
                  }}
                  className={`${ctl("totalCredits")} tabular-nums`}
                />
              )}
            </Field>
            <Field
              label="Package value (₹)"
              name="price"
              required
              error={errors.price}
              hint={source.type === "PAYMENTS" ? "Usually the amount already paid." : "Fixed: the amount already invoiced for this package."}
            >
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  readOnly={source.type !== "PAYMENTS"}
                  value={source.type === "PAYMENTS" ? price : String(source.value ?? "")}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`${ctl("price")} tabular-nums ${source.type !== "PAYMENTS" ? "opacity-80" : ""}`}
                />
              )}
            </Field>
            <Field label="Start date" name="startDate" required error={errors.startDate}>
              {(p) => <input {...p} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={ctl("startDate")} />}
            </Field>
            <Field label="Valid until (optional)" name="expiryDate" error={errors.expiryDate}>
              {(p) => <input {...p} type="date" value={expiryDate} min={startDate || undefined} onChange={(e) => setExpiryDate(e.target.value)} className={ctl("expiryDate")} />}
            </Field>
          </div>
        </div>

        {options.subjects.length > 0 && (
          <fieldset className="space-y-2" data-field="allocations">
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink-muted">
              <span>Classes per subject</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAllocations(split(Number(totalCredits) || 0, subjectIds))}
                  className="inline-flex items-center min-h-[44px] text-xs text-brand hover:underline font-semibold"
                >
                  Split evenly
                </button>
                <span className={`tabular-nums ${allocatedTotal === Number(totalCredits) ? "text-success" : "text-warning"}`}>
                  {allocatedTotal} of {Number(totalCredits) || 0} shared
                </span>
              </div>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.subjects.map((s) => (
                <Field key={s.subjectId} label={`${s.name} classes`} name={`alloc-${s.subjectId}`}>
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={allocations[s.subjectId] ?? "0"}
                      onChange={(e) => setAllocations((prev) => ({ ...prev, [s.subjectId]: e.target.value }))}
                      className={`${ctl("allocations")} tabular-nums`}
                    />
                  )}
                </Field>
              ))}
            </div>
            {errors.allocations && <p className="text-sm font-medium text-danger">{errors.allocations}</p>}
          </fieldset>
        )}

        <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-canvas p-3 text-sm sm:grid-cols-3" aria-label="Summary">
          <div><dt className="text-ink-muted">Package value</dt><dd className="font-bold text-ink tabular-nums">{inr(value)}</dd></div>
          <div><dt className="text-ink-muted">Paid already</dt><dd className="font-bold text-success tabular-nums">{inr(paidFromExisting)}</dd></div>
          <div><dt className="text-ink-muted">New payment created</dt><dd className="font-bold text-ink tabular-nums">₹0</dd></div>
          <div><dt className="text-ink-muted">Total classes</dt><dd className="font-bold text-ink tabular-nums">{Number(totalCredits) || 0}</dd></div>
          <div><dt className="text-ink-muted">Balance classes</dt><dd className="font-bold text-teal-400 tabular-nums">{Number(totalCredits) || 0}</dd></div>
          <div><dt className="text-ink-muted">Still to pay</dt><dd className={`font-bold tabular-nums ${stillToPay ? "text-warning" : "text-ink"}`}>{inr(stillToPay)}</dd></div>
        </dl>
        {source.type === "PAYMENTS" && options.unusedTotal > value && value > 0 && (
          <p className="text-sm text-ink-muted">{inr(options.unusedTotal - value)} of the existing payment stays as advance for later.</p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" icon={Link2} loading={saving} disabled={options.subjects.length === 0}>
            Assign package
          </Button>
        </div>
        <p className="sr-only" role="status">{saving ? "Assigning the package…" : ""}</p>
      </form>
    </ModalShell>
  );
}
