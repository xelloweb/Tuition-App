"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { isActivePath, navGroupsFor } from "./navigation";
import { NavBadge } from "./NavBadge";

/** Desktop navigation (1024px and wider). Phones and tablets use the bottom bar and "More". */
export function Sidebar({ currentRole, badges = {} }: { currentRole: string; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const groups = navGroupsFor(currentRole);

  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-line bg-surface">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/" className="flex items-center gap-2.5 rounded-control">
          <Image
            src="/brand/xello-mark.png"
            alt="Xello Logo"
            width={32}
            height={32}
            className="rounded-full shadow-sm"
            priority
          />
          <span className="text-base font-bold tracking-tight text-ink">Xello Tuition</span>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{group.label}</h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[40px] items-center gap-3 rounded-control px-3 py-2 text-sm ${
                        active ? "bg-brand/15 font-semibold text-brand-text" : "text-ink-muted hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                      <NavBadge count={badges[item.href]} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
