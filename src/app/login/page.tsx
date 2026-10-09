"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

/** Only same-site paths: a crafted ?callbackUrl= must not send staff to another website. */
function safeCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

const NOTICES: Record<string, string> = {
  password: "Your password was changed and all devices were signed out. Sign in with the new password.",
  "password-set": "Your password is set. Sign in to continue.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl"));
  const notice = NOTICES[searchParams.get("changed") ?? ""];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", { redirect: false, email, password, callbackUrl });
      if (!res || res.error) {
        setError(res?.error || "Could not sign in. Please try again.");
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your internet connection and try again.");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/60";

  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex items-center gap-3.5 mb-8">
          <Image
            src="/brand/xello-mark.png"
            alt="Xello Logo"
            width={48}
            height={48}
            className="rounded-full shadow-md"
            priority
          />
          <div>
            <Image
              src="/brand/xello-logo.png"
              alt="Xello"
              width={110}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
            <p className="text-xs text-slate-400 mt-0.5">Staff and trainer sign-in</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">Sign in</h1>

        {notice && !error && (
          <div role="status" className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2.5 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2.5 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-semibold text-slate-200">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@xellotuition.com"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-semibold text-slate-200">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-teal-400 px-4 py-3 text-base font-bold text-slate-950 hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Signing in…" : "Continue"}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </form>
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-center">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-teal-400 hover:text-teal-300 hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        
      </div>
    </main>
  );
}
