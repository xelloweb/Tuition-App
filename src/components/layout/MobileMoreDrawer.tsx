"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  Layers,
  GraduationCap,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  Globe2,
  UserCheck,
  Crown,
  ShieldAlert,
  Calculator,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { CurrentUser } from "@/lib/types";
import { TIMEZONES } from "@/lib/timezones";

interface MobileMoreDrawerProps {
  currentUser: CurrentUser;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMoreDrawer({
  currentUser,
  isOpen,
  onClose,
}: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (!isOpen) return null;

  const handleTzChange = (tz: string) => {
    document.cookie = `xello_display_tz=${encodeURIComponent(tz)}; path=/; max-age=86400`;
    router.refresh();
    onClose();
  };

  const allSecondaryNav = [
    {
      label: "Packages & Credits",
      href: "/packages",
      icon: Layers,
      roles: ["OWNER", "COORDINATOR"],
      desc: "Shared subject balances & reallocation",
    },
    {
      label: "Teachers Directory",
      href: "/teachers",
      icon: GraduationCap,
      roles: ["OWNER", "COORDINATOR", "TEACHER", "ACCOUNTS"],
      desc: "Faculty profiles & standard pay rates",
    },
    {
      label: currentUser.role === "TEACHER" ? "My Earnings & Payouts" : "Teacher Payouts",
      href: "/payouts",
      icon: DollarSign,
      roles: ["OWNER", "ACCOUNTS", "TEACHER"],
      desc: currentUser.role === "TEACHER" ? "Your class earnings and payout history" : "Batch payroll runs & rate snapshots",
    },
    {
      label: "Progress Reports",
      href: "/progress",
      icon: FileText,
      roles: ["OWNER", "COORDINATOR", "TEACHER"],
      desc: "Student progress notes & feedback",
    },
    {
      label: "Reports & CSV Exports",
      href: "/reports",
      icon: BarChart3,
      roles: ["OWNER", "COORDINATOR", "ACCOUNTS"],
      desc: "Financial & academic sanitized data",
    },
    {
      label: "Settings & System Audit",
      href: "/settings",
      icon: Settings,
      roles: ["OWNER", "COORDINATOR"],
      desc: "Configuration, policies & audit logs",
    },
  ];

  const filteredSecondary = allSecondaryNav.filter((it) =>
    it.roles.includes(currentUser.role)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-h-[85vh] rounded-t-3xl bg-[#0c1220] border-t border-slate-800 p-5 shadow-2xl flex flex-col overflow-hidden pb-safe animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
              Operations Navigation
            </span>
            <h3 className="text-base font-extrabold text-white mt-0.5">
              More Services & Tools
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white min-touch-target flex items-center justify-center transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto space-y-4 py-4">
          {/* Secondary Nav Grid */}
          <div className="grid grid-cols-1 gap-2">
            {filteredSecondary.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3.5 p-3 rounded-2xl transition-all border ${
                    isActive
                      ? "bg-teal-500/15 border-teal-500/30 text-teal-300 font-bold shadow-[0_0_15px_rgba(20,184,166,0.15)]"
                      : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                      isActive
                        ? "bg-teal-500 text-slate-950 font-bold"
                        : "bg-slate-800 border border-slate-700 text-slate-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white">{item.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.desc}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Account (signed-in user) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              Signed in as
            </span>
            <div className="text-xs">
              <div className="font-bold text-white">{currentUser.name}</div>
              <div className="text-slate-400 break-all">{currentUser.email}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <a
                href="/account/password"
                className="p-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700 font-semibold text-slate-200 hover:border-teal-500 hover:bg-teal-500/10 transition-colors"
              >
                Change password
              </a>
              <a
                href="/api/auth/signout"
                className="p-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
              >
                Sign out
              </a>
            </div>
          </div>

          {/* Timezone Setting */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5" />
              Scheduling Display Timezone
            </span>
            <select
              defaultValue="Asia/Kolkata"
              onChange={(e) => handleTzChange(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-2.5 text-xs font-semibold text-white focus:outline-hidden"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-slate-900 text-slate-200">
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
