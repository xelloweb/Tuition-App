"use client";

import { useRef, useState } from "react";
import { Banknote, X } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage, newIdempotencyKey } from "@/lib/client-api";
import { ModalShell } from "@/components/ui/ModalShell";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "STRIPE", label: "Stripe" },
];

const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/**
 * Records money a parent says they paid. Recording never reduces an invoice
 * balance: Accounts verify it against the bank and allocate it afterwards.
 */
export function RecordPaymentDialog({
  students,
  onClose,
  onRecorded,
}: {
  students: { id: string; name: string; studentCode: string }[];
  onClose: () => void;
  onRecorded: (message: string) => void;
}) {
  const submitting = useRef(false);
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayIst());
  const [method, setMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const errors: Record<string, string> = {};
    if (!studentId) errors.studentId = "Choose the student.";
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) errors.amount = "Enter the amount in whole rupees.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ payment: { paymentNumber: string; amount: number }; replayed?: boolean }>("/api/payments", {
        method: "POST",
        idempotencyKey,
        body: { studentId, amount: value, receivedDate, paymentMethod: method, reference: reference || undefined, proofFileName: proofFileName || undefined, notes: notes || undefined },
      });
      onRecorded(
        `Payment ${data.payment.paymentNumber} for ₹${data.payment.amount.toLocaleString("en-IN")} recorded${data.replayed ? " (already saved; no duplicate)" : ""}. It reduces no balance until it is verified under “Awaiting verification”.`
      );
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Could not record the payment."));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const ctl = (field: string) => `${controlClass} ${controlBorder(!!fieldErrors[field])}`;
  return (
    <ModalShell labelledBy="record-payment-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-lg">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="record-payment-title" className="text-xl font-bold text-ink">Record a payment</h2>
            <p className="text-sm text-ink-muted">Amounts are in INR. Verification against the bank is a separate step.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Student" name="studentId" required error={fieldErrors.studentId}>
          {(p) => (
            <select {...p} value={studentId} onChange={(e) => setStudentId(e.target.value)} className={ctl("studentId")}>
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.studentCode})</option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" name="amount" required error={fieldErrors.amount}>
            {(p) => <input {...p} type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${ctl("amount")} tabular-nums`} />}
          </Field>
          <Field label="Received on (IST date)" name="receivedDate" error={fieldErrors.receivedDate}>
            {(p) => <input {...p} type="date" max={todayIst()} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={ctl("receivedDate")} />}
          </Field>
          <Field label="Method" name="paymentMethod" error={fieldErrors.paymentMethod}>
            {(p) => (
              <select {...p} value={method} onChange={(e) => setMethod(e.target.value)} className={ctl("paymentMethod")}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Reference (optional)" name="reference" error={fieldErrors.reference} hint="UPI or bank reference number">
            {(p) => <input {...p} type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={ctl("reference")} />}
          </Field>
        </div>
        <Field label="Receipt or screenshot name (optional)" name="proofFileName" error={fieldErrors.proofFileName} hint="File upload is not available yet: note the file name so it can be found later.">
          {(p) => <input {...p} type="text" value={proofFileName} onChange={(e) => setProofFileName(e.target.value)} className={ctl("proofFileName")} />}
        </Field>
        <Field label="Notes (optional)" name="notes" error={fieldErrors.notes}>
          {(p) => <textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={ctl("notes")} />}
        </Field>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} icon={Banknote}>Record payment</Button>
        </div>
      </form>
    </ModalShell>
  );
}
