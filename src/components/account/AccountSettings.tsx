"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { KeyRound, RefreshCw, CheckCircle2, UserRound } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { FieldError, FormErrorSummary, inputClass } from "@/components/ui/FormFeedback";
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from "@/lib/password-rules";

// 44px tall; 16px text on phones so iPhones do not zoom in on focus.
const inputBase = "w-full min-h-[44px] rounded-xl border bg-slate-950 px-3 py-2.5 text-base sm:text-sm text-white focus:outline-hidden";
const buttonClass =
  "w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 min-h-[44px] text-sm font-bold text-slate-950 disabled:opacity-50";

function DisplayNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setDone("");
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ message: string }>("/api/auth/profile", { method: "POST", body: { name: name.trim() } });
      setDone(data.message);
      router.refresh(); // updates the name shown in the header
    } catch (err) {
      setError(err instanceof ClientApiError && err.fieldErrors.name ? err.fieldErrors.name : errorMessage(err, "Could not update your name."));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-slate-800/80 bg-slate-900 p-5 sm:p-6 space-y-4 text-xs">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <UserRound className="h-4 w-4 text-teal-400" /> Your name
      </h3>
      {done && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {done}
        </div>
      )}
      <div>
        <label htmlFor="display-name" className="block font-semibold text-slate-300 mb-1">Name shown in the app</label>
        <input
          id="display-name"
          type="text"
          autoComplete="name"
          value={name}
          aria-invalid={!!error}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          className={inputClass(inputBase, !!error)}
        />
        <FieldError message={error} />
      </div>
      <button type="submit" disabled={saving} className={buttonClass}>
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
        Save name
      </button>
    </form>
  );
}

function ChangePasswordForm() {
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
    const problem = newPasswordProblem(newPassword);
    if (problem) errors.newPassword = problem;
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
      // The server ended every session (this one too); go to the login page with a notice.
      await signOut({ callbackUrl: "/login?changed=password" });
      return;
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setFormError(errorMessage(err, "Could not change the password."));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-slate-800/80 bg-slate-900 p-5 sm:p-6 space-y-4 text-xs">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-teal-400" /> Change password
      </h3>
      {done && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3 font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {done}
        </div>
      )}
      <FormErrorSummary message={formError} />
      <div>
        <label htmlFor="current-password" className="block font-semibold text-slate-300 mb-1">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass(inputBase, !!fieldErrors.currentPassword)} />
        <FieldError message={fieldErrors.currentPassword} />
      </div>
      <div>
        <label htmlFor="new-password" className="block font-semibold text-slate-300 mb-1">New password (at least {MIN_PASSWORD_LENGTH} characters)</label>
        <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass(inputBase, !!fieldErrors.newPassword)} />
        <FieldError message={fieldErrors.newPassword} />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block font-semibold text-slate-300 mb-1">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass(inputBase, !!fieldErrors.confirm)} />
        <FieldError message={fieldErrors.confirm} />
      </div>
      <button type="submit" disabled={saving} className={buttonClass}>
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Change password
      </button>
    </form>
  );
}

export function AccountSettings({ name, email }: { name: string; email: string }) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
          <UserRound className="h-4 w-4" />
          <span>My Account</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">My account</h1>
        <p className="text-xs text-slate-400 mt-0.5 break-all">Signed in as {email}</p>
      </div>
      <DisplayNameForm initialName={name} />
      <ChangePasswordForm />
    </div>
  );
}
