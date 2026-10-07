"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, ArrowRight, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-xl bg-teal-500/10 p-2 border border-teal-500/20">
            <GraduationCap className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Xello Tuition</h1>
            <p className="text-xs text-slate-400 font-medium">Operations Portal</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition-all"
              placeholder="you@xellotuition.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-teal-400 focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Signing in..." : "Continue"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
      
    </div>
  );
}
