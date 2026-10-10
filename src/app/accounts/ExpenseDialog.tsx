"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "@/lib/accounts-shared";
import type { ProfitAndLoss } from "@/lib/services/accounts";

export type ExpenseRow = ProfitAndLoss["expenseRows"][number];

/** Add or correct a business expense. Trainer pay is not entered here: it comes from attendance. */
export function ExpenseDialog({
  expense,
  today,
  onClose,
  onSaved,
}: {
  expense: ExpenseRow | null;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState({
    spentOn: expense?.spentOn ?? today,
    category: expense?.category ?? "",
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "",
    paymentMethod: expense?.paymentMethod ?? "UPI",
    paidTo: expense?.paidTo ?? "",
    reference: expense?.reference ?? "",
    notes: expense?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
    setFieldErrors((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });
  };
  const ctl = (key: string) => `${controlClass} ${controlBorder(Boolean(fieldErrors[key]))}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const body = { ...values, amount: values.amount.trim() === "" ? "" : Number(values.amount.replace(/[,₹\s]/g, "")) };
      const res = await apiRequest<{ message: string }>(expense ? `/api/expenses/${expense.id}` : "/api/expenses", { method: expense ? "PATCH" : "POST", body });
      onSaved(res.message);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "The expense could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell labelledBy="expense-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 id="expense-title" className="text-lg font-bold text-ink">{expense ? `Edit expense ${expense.expenseNumber}` : "Add expense"}</h2>
          <p className="text-sm text-ink-muted">Trainer pay is not entered here: it is counted from attendance and Trainer payouts.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date spent" name="spentOn" required error={fieldErrors.spentOn}>
            {(p) => <input {...p} type="date" max={today} value={values.spentOn} onChange={(e) => set("spentOn", e.target.value)} className={ctl("spentOn")} />}
          </Field>
          <Field label="Amount (₹)" name="amount" required error={fieldErrors.amount} hint="Whole rupees">
            {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" value={values.amount} onChange={(e) => set("amount", e.target.value)} className={`${ctl("amount")} tabular-nums`} />}
          </Field>
          <Field label="Category" name="category" required error={fieldErrors.category}>
            {(p) => (
              <select {...p} value={values.category} onChange={(e) => set("category", e.target.value)} className={ctl("category")}>
                <option value="">Choose…</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </Field>
          <Field label="Paid by" name="paymentMethod" required error={fieldErrors.paymentMethod}>
            {(p) => (
              <select {...p} value={values.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={ctl("paymentMethod")}>
                {EXPENSE_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Description" name="description" required error={fieldErrors.description} hint="For example: October office rent">
          {(p) => <input {...p} type="text" maxLength={200} value={values.description} onChange={(e) => set("description", e.target.value)} className={ctl("description")} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid to (optional)" name="paidTo" error={fieldErrors.paidTo}>
            {(p) => <input {...p} type="text" maxLength={120} value={values.paidTo} onChange={(e) => set("paidTo", e.target.value)} className={ctl("paidTo")} />}
          </Field>
          <Field label="Reference (optional)" name="reference" error={fieldErrors.reference} hint="Bill or transaction number">
            {(p) => <input {...p} type="text" maxLength={120} value={values.reference} onChange={(e) => set("reference", e.target.value)} className={ctl("reference")} />}
          </Field>
        </div>
        <Field label="Notes (optional)" name="notes" error={fieldErrors.notes}>
          {(p) => <textarea {...p} rows={2} maxLength={1000} value={values.notes} onChange={(e) => set("notes", e.target.value)} className={ctl("notes")} />}
        </Field>
        {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm font-medium text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" icon={Save} loading={saving}>{expense ? "Save changes" : "Save expense"}</Button>
        </div>
      </form>
    </ModalShell>
  );
}
