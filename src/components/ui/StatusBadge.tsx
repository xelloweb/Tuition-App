import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export type StatusType =
  | "ACTIVE"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "STUDENT_NO_SHOW"
  | "TEACHER_NO_SHOW"
  | "PENDING"
  | "OVERDUE"
  | "PAID"
  | "PARTIAL"
  | "APPROVED"
  | "REVERSED"
  | "INACTIVE";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  size = "sm",
  className = "",
  showIcon = true,
}: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  let label = status;
  let bg = "bg-slate-800 text-slate-400 border-slate-700";
  let Icon = Clock;

  switch (normalized) {
    case "ACTIVE":
      label = "Active";
      bg = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
      Icon = CheckCircle2;
      break;
    case "COMPLETED":
      label = "Completed";
      bg = "bg-teal-500/15 text-teal-300 border-teal-500/30 shadow-[0_0_8px_rgba(20,184,166,0.15)]";
      Icon = CheckCircle2;
      break;
    case "SCHEDULED":
      label = "Scheduled";
      bg = "bg-sky-500/15 text-sky-300 border-sky-500/30";
      Icon = Clock;
      break;
    case "PENDING":
    case "ATTENDANCE_PENDING":
      label = "Pending";
      bg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      Icon = Clock;
      break;
    case "PAID":
      label = "Paid in Full";
      bg = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
      Icon = ShieldCheck;
      break;
    case "PARTIAL":
      label = "Partial Paid";
      bg = "bg-blue-500/15 text-blue-300 border-blue-500/30";
      Icon = Clock;
      break;
    case "OVERDUE":
      label = "Overdue";
      bg = "bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]";
      Icon = AlertCircle;
      break;
    case "CANCELLED":
      label = "Cancelled";
      bg = "bg-slate-800 text-slate-400 border-slate-700";
      Icon = XCircle;
      break;
    case "STUDENT_NO_SHOW":
      label = "Student Absent";
      bg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      Icon = AlertCircle;
      break;
    case "TEACHER_NO_SHOW":
      label = "Teacher Absent (0 Deduct)";
      bg = "bg-rose-500/15 text-rose-300 border-rose-500/30";
      Icon = AlertCircle;
      break;
    case "APPROVED":
      label = "Approved";
      bg = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
      Icon = ShieldCheck;
      break;
    case "REVERSED":
      label = "Reversed";
      bg = "bg-purple-500/15 text-purple-300 border-purple-500/30";
      Icon = RotateCcw;
      break;
    case "INACTIVE":
      label = "Inactive";
      bg = "bg-slate-800 text-slate-500 border-slate-700";
      Icon = XCircle;
      break;
    case "PAUSED":
      label = "Paused";
      bg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      Icon = Clock;
      break;
    case "WITHDRAWN":
      label = "Archived";
      bg = "bg-slate-800 text-slate-400 border-slate-700";
      Icon = XCircle;
      break;
    case "PARTIALLY_PAID":
      label = "Partially Paid";
      bg = "bg-blue-500/15 text-blue-300 border-blue-500/30";
      Icon = Clock;
      break;
    case "UNPAID":
      label = "Unpaid";
      bg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
      Icon = Clock;
      break;
    default:
      label = status;
      bg = "bg-slate-800 text-slate-300 border-slate-700";
      Icon = Sparkles;
      break;
  }

  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2.5 py-0.5 gap-1"
      : "text-xs px-3 py-1 gap-1.5 font-semibold";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${bg} ${sizeClasses} ${className}`}
    >
      {showIcon && <Icon className={size === "sm" ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />}
      <span>{label}</span>
    </span>
  );
}
