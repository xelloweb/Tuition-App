"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { GraduationCap, LogOut } from "lucide-react";
import { CurrentUser } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  COORDINATOR: "Coordinator",
  TEACHER: "Trainer",
  ACCOUNTS: "Accounts",
};

/**
 * Top bar: brand (phones), today's date in IST, and the account controls.
 * All times in the application are India Standard Time; there is no zone switcher.
 */
export function Header({ currentUser, istToday }: { currentUser: CurrentUser; istToday: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex items-center gap-2 rounded-control lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-brand-ink" aria-hidden="true">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-base font-bold text-ink">Xello</span>
        </Link>
        <p className="truncate text-sm text-ink-muted">
          <span className="hidden sm:inline">{istToday} · </span>
          <span className="font-semibold text-ink">All times in IST</span>
          <span className="hidden md:inline"> (UTC+05:30)</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden text-right xl:block">
          <p className="text-sm font-semibold leading-tight text-ink">{currentUser.name}</p>
          <p className="text-xs text-ink-subtle">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
        </div>
        <span className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink-muted xl:hidden">
          {ROLE_LABELS[currentUser.role] ?? currentUser.role}
        </span>
        <Link
          href="/account"
          className="hidden min-h-[40px] items-center rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised sm:inline-flex"
        >
          My account
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="hidden min-h-[40px] items-center gap-1.5 rounded-control border border-rose-400/50 px-3 text-sm font-semibold text-danger hover:bg-rose-400/10 sm:inline-flex"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </header>
  );
}
