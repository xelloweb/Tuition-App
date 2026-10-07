"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Globe2,
  UserCheck,
  ShieldAlert,
  GraduationCap,
  Calculator,
  Crown,
  Clock,
} from "lucide-react";
import { TIMEZONES, formatTimeOnly } from "@/lib/timezones";
import { CurrentUser } from "@/lib/types";

interface HeaderProps {
  currentUser: CurrentUser;
  displayTimeZone: string;
  onOpenMobile: () => void;
}

export function Header({ currentUser, displayTimeZone, onOpenMobile }: HeaderProps) {
  const router = useRouter();
  // Initial value comes from the xello_display_tz cookie, read on the server.
  const [selectedTz, setSelectedTz] = useState(displayTimeZone);
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(formatTimeOnly(new Date(), selectedTz));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [selectedTz]);

  const handlePersonaChange = (personaKey: string) => {
    document.cookie = `xello_user_persona=${personaKey}; path=/; max-age=86400`;
    router.refresh();
  };

  const handleTzChange = (tz: string) => {
    setSelectedTz(tz);
    document.cookie = `xello_display_tz=${encodeURIComponent(tz)}; path=/; max-age=86400`;
    router.refresh();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "OWNER":
        return {
          label: "Admin",
          fullLabel: "Owner / Admin",
          bg: "bg-purple-950/60 text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
          icon: Crown,
        };
      case "COORDINATOR":
        return {
          label: "Coordinator",
          fullLabel: "Academic Coordinator",
          bg: "bg-blue-950/60 text-blue-300 border-blue-500/30",
          icon: ShieldAlert,
        };
      case "TEACHER":
        return {
          label: "Teacher",
          fullLabel: "Teacher / Tutor",
          bg: "bg-teal-950/60 text-teal-300 border-teal-500/30 shadow-[0_0_12px_rgba(20,184,166,0.15)]",
          icon: GraduationCap,
        };
      case "ACCOUNTS":
        return {
          label: "Accounts",
          fullLabel: "Accounts & Billing",
          bg: "bg-amber-950/60 text-amber-300 border-amber-500/30",
          icon: Calculator,
        };
      default:
        return {
          label: role,
          fullLabel: role,
          bg: "bg-slate-900 text-slate-300 border-slate-800",
          icon: UserCheck,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);
  const RoleIcon = badge.icon;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-[#090d16]/85 px-3 sm:px-6 backdrop-blur-xl">
      {/* Left: Mobile trigger & context */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-slate-850/80 lg:hidden min-touch-target flex items-center justify-center shrink-0 transition-colors"
          aria-label="Open navigation drawer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm sm:text-base tracking-tight text-white truncate">
              Xello Tuition
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 uppercase tracking-wider">
              Operations
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block truncate">
            Kerala & GCC Tuition Operations
          </p>
        </div>
      </div>

      {/* Right: Switchers & User pill */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Timezone Switcher */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300 shadow-sm">
          <Globe2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <select
            value={selectedTz}
            onChange={(e) => handleTzChange(e.target.value)}
            className="bg-transparent font-medium text-slate-200 focus:outline-hidden cursor-pointer text-xs"
            title="Display Timezone for Session Scheduling"
            aria-label="Display timezone"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-slate-900 text-slate-200">
                {tz.label.split(" (")[0]}
              </option>
            ))}
          </select>
          {currentTimeStr && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-teal-400 font-mono pl-2 border-l border-slate-800">
              <Clock className="h-3 w-3" />
              {currentTimeStr}
            </span>
          )}
        </div>

        <div className="hidden sm:flex items-center">
          <button
            onClick={() => {
              // Using window.location.href because signOut from next-auth/react might require 'use client' and provider context.
              // Actually, since we're using NextAuth, we can navigate to /api/auth/signout
              window.location.href = '/api/auth/signout';
            }}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-2 pl-1 sm:pl-2 sm:border-l border-slate-800">
          <div className="hidden xl:block text-right">
            <div className="text-xs font-bold text-white leading-tight">
              {currentUser.name}
            </div>
            <div className="text-[10px] text-slate-400">{currentUser.email}</div>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${badge.bg}`}
          >
            <RoleIcon className="h-3 w-3 shrink-0" />
            <span>{badge.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
