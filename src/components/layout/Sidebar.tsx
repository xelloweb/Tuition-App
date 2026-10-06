"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  Receipt,
  AlertCircle,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  Layers,
  X,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  currentRole: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ currentRole, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      roles: ["OWNER", "COORDINATOR", "TEACHER", "ACCOUNTS"],
    },
    {
      label: "Students",
      href: "/students",
      icon: Users,
      roles: ["OWNER", "COORDINATOR", "ACCOUNTS"],
    },
    {
      label: "Packages & Credits",
      href: "/packages",
      icon: Layers,
      roles: ["OWNER", "COORDINATOR"],
    },
    {
      label: "Teachers",
      href: "/teachers",
      icon: GraduationCap,
      roles: ["OWNER", "COORDINATOR"],
    },
    {
      label: "Timetable",
      href: "/timetable",
      icon: CalendarDays,
      roles: ["OWNER", "COORDINATOR", "TEACHER"],
    },
    {
      label: "Attendance & Inbox",
      href: "/attendance",
      icon: CheckCircle2,
      roles: ["OWNER", "COORDINATOR", "TEACHER"],
    },
    {
      label: "Payments & Invoices",
      href: "/billing",
      icon: Receipt,
      roles: ["OWNER", "ACCOUNTS"],
    },
    {
      label: "Dues & Follow-ups",
      href: "/dues",
      icon: AlertCircle,
      roles: ["OWNER", "ACCOUNTS", "COORDINATOR"],
    },
    {
      label: "Progress Reports",
      href: "/progress",
      icon: FileText,
      roles: ["OWNER", "COORDINATOR", "TEACHER"],
    },
    {
      label: "Teacher Payouts",
      href: "/payouts",
      icon: DollarSign,
      roles: ["OWNER", "ACCOUNTS"],
    },
    {
      label: "Reports & Exports",
      href: "/reports",
      icon: BarChart3,
      roles: ["OWNER", "COORDINATOR", "ACCOUNTS"],
    },
    {
      label: "Settings & Audit",
      href: "/settings",
      icon: Settings,
      roles: ["OWNER", "COORDINATOR"],
    },
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-0 -translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white font-bold shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-wider text-slate-900">
                XELLO
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-teal-600 ml-1.5 px-1.5 py-0.5 rounded bg-teal-50">
                Tuition
              </span>
              <p className="text-[10px] text-slate-500 font-medium">
                Kerala & GCC Operations
              </p>
            </div>
          </Link>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operations Menu
          </div>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-teal-50 text-teal-800 shadow-2xs font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 ${
                    active ? "text-teal-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 p-4 bg-slate-50/70">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Live System</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Shared Balance & Ledger Engine v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
