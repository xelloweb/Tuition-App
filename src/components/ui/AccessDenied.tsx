import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

/** Server-rendered notice for pages a role may not open (direct URL access included). */
export function AccessDenied({ message = "Your role does not have access to this page." }: { message?: string }) {
  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-8 sm:p-10 space-y-4 shadow-xl">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Access restricted</h2>
        <p className="text-xs text-slate-400">{message}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
