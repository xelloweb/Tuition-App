"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";

export default function SetupPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#070a12] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/60 rounded-3xl border border-slate-800 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid Invite Link</h2>
          <p className="text-slate-400 text-sm">
            This invitation link is missing or malformed. Please contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest("/api/auth/setup-password", { method: "POST", body: { token, password } });
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(errorMessage(err, "Could not set the password. Try again."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-teal-500/10 p-2 border border-teal-500/20">
            <GraduationCap className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Xello Tuition</h1>
            <p className="text-xs text-slate-400 font-medium">Trainer Setup</p>
          </div>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Password Set Successfully!</h2>
            <p className="text-sm text-slate-400">
              You can now log in with your email and new password. Redirecting to login...
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-2">Set Your Password</h2>
            <p className="text-sm text-slate-400 mb-6">Create a secure password to activate your trainer account.</p>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition-all"
                  placeholder="At least 10 characters"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition-all"
                  placeholder="Repeat password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-teal-400 focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? "Saving..." : "Set Password"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
