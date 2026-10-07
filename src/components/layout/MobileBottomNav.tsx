"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { isActivePath, mobilePrimaryFor } from "./navigation";

/** Phone and tablet navigation: up to four destinations for the role plus "More". */
export function MobileBottomNav({
  currentRole,
  moreOpen,
  onOpenMore,
}: {
  currentRole: string;
  moreOpen: boolean;
  onOpenMore: () => void;
}) {
  const pathname = usePathname();
  const items = mobilePrimaryFor(currentRole);

  return (
    <nav
      aria-label="Main"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe lg:hidden"
    >
      <ul className="grid h-16 grid-flow-col auto-cols-fr items-stretch px-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs ${
                  active ? "font-semibold text-brand-text" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={onOpenMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs text-ink-muted hover:text-ink"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
