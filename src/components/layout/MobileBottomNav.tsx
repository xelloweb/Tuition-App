"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Receipt,
  DollarSign,
  Menu,
} from "lucide-react";

interface MobileBottomNavProps {
  currentRole: string;
  onOpenMore: () => void;
}

export function MobileBottomNav({
  currentRole,
  onOpenMore,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  const getRoleNavItems = () => {
    switch (currentRole) {
      case "TEACHER":
        return [
          { label: "Today", href: "/timetable", icon: CalendarDays },
          { label: "Students", href: "/students", icon: Users },
          { label: "Attendance", href: "/attendance", icon: CheckCircle2 },
        ];
      case "ACCOUNTS":
        return [
          { label: "Home", href: "/", icon: LayoutDashboard },
          { label: "Billing", href: "/billing", icon: Receipt },
          { label: "Dues", href: "/dues", icon: AlertCircle },
          { label: "Payouts", href: "/payouts", icon: DollarSign },
        ];
      default: // OWNER / COORDINATOR
        return [
          { label: "Home", href: "/", icon: LayoutDashboard },
          { label: "Students", href: "/students", icon: Users },
          { label: "Schedule", href: "/timetable", icon: CalendarDays },
          { label: "Dues", href: "/dues", icon: AlertCircle },
        ];
    }
  };

  const items = getRoleNavItems();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/90 bg-[#0c1220]/95 backdrop-blur-2xl pb-safe lg:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.7)]"
    >
      <div className="grid grid-flow-col auto-cols-fr items-center h-16 px-1.5">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-touch-target py-1 transition-all ${
                isActive
                  ? "text-teal-300 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-[0_0_12px_rgba(20,184,166,0.25)]"
                    : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center min-touch-target py-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Open secondary navigation menu"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 leading-none">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
