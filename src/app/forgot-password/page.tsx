import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

/**
 * Explains how to get a new password. Nothing here changes an account: a public
 * reset form let anyone take over any login (7–8 Oct 2026), so passwords are only
 * reset by the owner (Users & logins) or, for the owner, from the hosting account.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/brand/xello-mark.png"
            alt="Xello Logo"
            width={40}
            height={40}
            className="rounded-full shadow-sm"
            priority
          />
          <div>
            <p className="text-lg font-bold text-white">Xello Tuition</p>
            <p className="text-sm text-slate-300">Staff and trainer sign-in</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">Forgot your password?</h1>

        <section aria-labelledby="staff-heading" className="space-y-2">
          <h2 id="staff-heading" className="text-base font-semibold text-white">Staff and trainers</h2>
          <p className="text-base text-slate-300">
            Ask the owner for a new password link. The owner creates it under <strong className="text-white">Users &amp; logins</strong> and
            sends it to you. The link works once.
          </p>
        </section>

        <section aria-labelledby="owner-heading" className="mt-6 space-y-2 border-t border-slate-800 pt-4">
          <h2 id="owner-heading" className="text-base font-semibold text-white">Owner</h2>
          <p className="text-base text-slate-300">
            The owner password can only be reset by whoever manages the website&apos;s hosting account. Follow the owner recovery
            steps in your Xello handover notes.
          </p>
        </section>

        <div className="mt-8 pt-4 border-t border-slate-800">
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-teal-300 hover:text-teal-200 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
