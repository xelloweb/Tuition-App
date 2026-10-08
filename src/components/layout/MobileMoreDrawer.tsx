"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { X } from "lucide-react";
import { CurrentUser } from "@/lib/types";
import { ModalShell } from "@/components/ui/ModalShell";
import { isActivePath, mobileMoreFor } from "./navigation";
import { NavBadge } from "./NavBadge";

/** The rest of the navigation on phones and tablets, plus the account actions. */
export function MobileMoreDrawer({
  currentUser,
  isOpen,
  onClose,
  badges = {},
}: {
  currentUser: CurrentUser;
  isOpen: boolean;
  onClose: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  if (!isOpen) return null;
  const groups = mobileMoreFor(currentUser.role);

  return (
    <ModalShell labelledBy="more-menu-title" onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <h2 id="more-menu-title" className="text-lg font-semibold text-ink">
          More
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="More pages" className="space-y-4 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{group.label}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[48px] items-center gap-3 rounded-control px-3 py-2 ${
                        active ? "bg-brand/15 text-brand-text" : "text-ink hover:bg-raised"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block text-xs text-ink-subtle">{item.description}</span>
                      </span>
                      <NavBadge count={badges[item.href]} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line pt-4">
        <div className="text-sm">
          <p className="text-ink-subtle">Signed in as</p>
          <p className="font-semibold text-ink break-words">{currentUser.name}</p>
          <p className="text-ink-muted break-all">{currentUser.email}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/account"
            onClick={onClose}
            className="flex min-h-[44px] items-center justify-center rounded-control border border-line-strong text-sm font-semibold text-ink hover:bg-raised"
          >
            My account
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex min-h-[44px] items-center justify-center rounded-control border border-rose-400/50 text-sm font-semibold text-danger hover:bg-rose-400/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
