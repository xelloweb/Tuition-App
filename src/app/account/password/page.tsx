"use client";

import { useRef, useState } from "react";
import { KeyRound, RefreshCw, CheckCircle2 } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { FieldError, FormErrorSummary, inputClass } from "@/components/ui/FormFeedback";

const inputBase = "w-full rounded-xl border bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-hidden";

export default function ChangePasswordPage() {
  const submittingRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const errors: Record<string, string> = {};
    if (newPassword.length < 10) errors.newPassword = "At least 10 characters.";
    if (newPassword !== confirm) errors.confirm = "Passwords do not match.";
    setFieldErrors(errors);
    setDone("");
    if (Object.keys(errors).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      const data = await apiRequest<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setDone(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setFormError(errorMessage(err, "Could not change the password."));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
          <KeyRound className="h-4 w-4" />
          <span>Account</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">Change password</h2>
        <p className="text-xs text-slate-400 mt-0.5">Use at least 10 characters. Do not reuse the demo password.</p>
      </div>

      {done && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {done}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 space-y-4 text-xs">
        <FormErrorSummary message={formError} />
        <div>
          <label htmlFor="current-password" className="block font-semibold text-slate-300 mb-1">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass(inputBase, !!fieldErrors.currentPassword)} />
          <FieldError message={fieldErrors.currentPassword} />
        </div>
        <div>
          <label htmlFor="new-password" className="block font-semibold text-slate-300 mb-1">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass(inputBase, !!fieldErrors.newPassword)} />
          <FieldError message={fieldErrors.newPassword} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block font-semibold text-slate-300 mb-1">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass(inputBase, !!fieldErrors.confirm)} />
          <FieldError message={fieldErrors.confirm} />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-4 py-2.5 min-h-[44px] text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Change password
        </button>
      </form>
    </div>
  );
}
