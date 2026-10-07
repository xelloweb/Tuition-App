"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GraduationCap, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from "@/lib/password-rules";

const inputClass =
  "w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/60";

export default function SetupPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const problem = newPasswordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/auth/setup-password", { method: "POST", body: { token, password } });
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err, "Could not set the password. Try again."));
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
          <p className="text-lg font-bold text-white">Xello Tuition</p>
        </div>

        {!token ? (
          <div className="space-y-3">
            <AlertTriangle className="h-8 w-8 text-rose-400" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-white">This link is incomplete</h1>
            <p className="text-sm text-slate-300">Ask the owner to create a new invitation or reset link for you.</p>
          </div>
        ) : success ? (
          <div className="space-y-4" role="status">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-white">Password set</h1>
            <p className="text-sm text-slate-300">Sign in with your email address and the new password.</p>
            <Link
              href="/login?changed=password-set"
              className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
            >
              Go to sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Set your password</h1>
            <p className="text-sm text-slate-300 mb-6">
              Choose a password of at least {MIN_PASSWORD_LENGTH} characters. The link works once.
            </p>

            {error && (
              <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2.5 text-sm text-rose-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-password" className="block text-sm font-semibold text-slate-200">
                  New password
                </label>
                <input
                  id="setup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-password-confirm" className="block text-sm font-semibold text-slate-200">
                  Repeat the new password
                </label>
                <input
                  id="setup-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? "Saving…" : "Set password"}
                {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
