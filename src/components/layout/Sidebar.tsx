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
      roles: ["OWNER", "COORDINATOR", "TEACHER", "ACCOUNTS"],
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
      label: currentRole === "TEACHER" ? "My Earnings & Payouts" : "Teacher Payouts",
      href: "/payouts",
      icon: DollarSign,
      roles: ["OWNER", "ACCOUNTS", "TEACHER"],
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800/80 bg-[#0c1220]/95 backdrop-blur-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl shadow-black/80" : "-translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 font-black shadow-lg shadow-teal-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-wider text-white">
                  XELLO
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30">
                  Tuition
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Kerala & GCC Operations
              </p>
            </div>
          </Link>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 lg:hidden transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-300 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.12)] font-semibold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 transition-colors ${
                    active ? "text-teal-400" : "text-slate-500"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800/80 p-4 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Live System</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Connected
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Shared Balance & Ledger Engine v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
