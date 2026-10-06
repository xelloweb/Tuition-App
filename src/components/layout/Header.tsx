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
  onOpenMobile: () => void;
}

export function Header({ currentUser, onOpenMobile }: HeaderProps) {
  const router = useRouter();
  const [selectedTz, setSelectedTz] = useState("Asia/Kolkata");
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  useEffect(() => {
    // Read display timezone from cookie if set
    const match = document.cookie.match(/xello_display_tz=([^;]+)/);
    if (match && match[1]) {
      setSelectedTz(decodeURIComponent(match[1]));
    }
  }, []);

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
          label: "Owner / Admin",
          bg: "bg-purple-100 text-purple-800 border-purple-200",
          icon: Crown,
        };
      case "COORDINATOR":
        return {
          label: "Academic Coordinator",
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          icon: ShieldAlert,
        };
      case "TEACHER":
        return {
          label: "Teacher / Tutor",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: GraduationCap,
        };
      case "ACCOUNTS":
        return {
          label: "Accounts & Billing",
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          icon: Calculator,
        };
      default:
        return {
          label: role,
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          icon: UserCheck,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);
  const RoleIcon = badge.icon;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6">
      {/* Left: Mobile trigger & context */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-sm font-bold text-slate-800 sm:text-base">
            Operations Portal
          </h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            One-to-One Online Tuition Management
          </p>
        </div>
      </div>

      {/* Right: Switchers & User pill */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Timezone Switcher */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-700">
          <Globe2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <select
            value={selectedTz}
            onChange={(e) => handleTzChange(e.target.value)}
            className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer"
            title="Display Timezone for Session Scheduling"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label.split(" (")[0]} ({tz.offset})
              </option>
            ))}
          </select>
          {currentTimeStr && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-teal-700 font-mono pl-1 border-l border-slate-200">
              <Clock className="h-3 w-3" />
              {currentTimeStr}
            </span>
          )}
        </div>

        {/* Persona Switcher for Instant Testing */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 hidden md:inline">
            Role Persona:
          </span>
          <select
            defaultValue={
              currentUser.role === "OWNER"
                ? "admin"
                : currentUser.role === "COORDINATOR"
                ? "coordinator"
                : currentUser.role === "ACCOUNTS"
                ? "accounts"
                : currentUser.email.includes("rahul")
                ? "teacher_rahul"
                : "teacher_priya"
            }
            onChange={(e) => handlePersonaChange(e.target.value)}
            className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer text-xs"
            title="Switch Persona to test role-based permissions"
          >
            <option value="admin">Owner / Admin (Devanand)</option>
            <option value="coordinator">Academic Coordinator (Aisha)</option>
            <option value="teacher_rahul">Teacher (Rahul - Chem)</option>
            <option value="teacher_priya">Teacher (Priya - Eng)</option>
            <option value="accounts">Accounts Manager (Joseph)</option>
          </select>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden lg:block text-right">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {currentUser.name}
            </div>
            <div className="text-[10px] text-slate-500">{currentUser.email}</div>
          </div>
          <div
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.bg}`}
          >
            <RoleIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{badge.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
