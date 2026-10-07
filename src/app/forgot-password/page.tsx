"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, ShieldCheck, KeyRound } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from "@/lib/password-rules";

const inputClass =
  "w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/60";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest<{
        success: boolean;
        isOwner?: boolean;
        isStaff?: boolean;
        resetToken?: string;
        message?: string;
      }>("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });

      if (res.isOwner) {
        setIsOwner(true);
      } else if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err) {
      setError(errorMessage(err, "Could not verify email. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const problem = newPasswordProblem(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          newPassword,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to update password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-teal-500/10 p-2 border border-teal-500/30">
            <GraduationCap className="h-6 w-6 text-teal-300" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Xello Tuition</p>
            <p className="text-sm text-slate-300">Password Recovery</p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4" role="status">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3 text-emerald-200">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-white text-base">Password Updated!</h2>
                <p className="text-sm mt-1 text-emerald-200/90">
                  Your new password is now active. You can proceed to sign in with your email and new password.
                </p>
              </div>
            </div>

            <Link
              href="/login?changed=password"
              className="mt-6 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
            >
              Back to Sign In <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : resetToken ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-4 text-teal-200 space-y-2">
              <h2 className="font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-teal-300" />
                Reset Link Ready
              </h2>
              <p className="text-sm text-slate-300">
                A secure password reset link has been created for <span className="font-semibold text-white">{email}</span>.
              </p>
            </div>

            <Link
              href={`/setup-password?token=${resetToken}`}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300"
            >
              Continue to Set New Password <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/login"
              className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-teal-400"
            >
              <ArrowLeft className="h-4 w-4" /> Return to sign in
            </Link>
          </div>
        ) : isOwner ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 flex items-center gap-2 text-xs text-teal-300">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Administrator account verified: {email}</span>
            </div>

            <h1 className="text-xl font-bold text-white">Set New Admin Password</h1>
            <p className="text-xs text-slate-400">
              Minimum {MIN_PASSWORD_LENGTH} characters. Make sure it is secure.
            </p>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2.5 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-200">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-200">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? "Updating password…" : "Save New Password"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setIsOwner(false);
                setError("");
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 cursor-pointer"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
            <p className="text-sm text-slate-300 mb-6">
              Enter the email address registered with your account to reset your password.
            </p>

            {error && (
              <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2.5 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailCheck} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="recovery-email" className="block text-sm font-semibold text-slate-200">
                  Email Address
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="admin@xellotuition.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? "Verifying…" : "Continue"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
