import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: string;
  variant?: "default" | "success" | "warning" | "danger" | "teal";
  href?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  variant = "default",
  href,
  className = "",
}: MetricCardProps) {
  const variantStyles = {
    default: {
      border: "border-slate-800 hover:border-slate-700",
      iconBg: "bg-slate-800/80 text-slate-300 border border-slate-700/80",
      valueColor: "text-white",
    },
    teal: {
      border: "border-teal-500/30 hover:border-teal-500/50",
      iconBg: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
      valueColor: "text-teal-300",
    },
    success: {
      border: "border-emerald-500/30 hover:border-emerald-500/50",
      iconBg: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      valueColor: "text-emerald-300",
    },
    warning: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      iconBg: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      valueColor: "text-amber-300",
    },
    danger: {
      border: "border-rose-500/30 hover:border-rose-500/50",
      iconBg: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
      valueColor: "text-rose-300",
    },
  }[variant];

  const content = (
    <div
      className={`rounded-2xl border bg-slate-900 p-4 sm:p-5 transition-all ${
        variantStyles.border
      } ${href ? "cursor-pointer hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98]" : ""} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400 line-clamp-1">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge && (
            <span className="rounded-full bg-slate-800 border border-slate-700/80 px-2 py-0.5 text-xs font-bold text-slate-300">
              {badge}
            </span>
          )}
          {Icon && (
            <div className={`rounded-xl p-2.5 ${variantStyles.iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          {href && (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-400 transition-colors" />
          )}
        </div>
      </div>

      <div className="mt-3">
        <div
          className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums font-mono ${variantStyles.valueColor}`}
        >
          {value}
        </div>
        {subtext && (
          <p className="mt-1 text-xs text-slate-400 line-clamp-1">{subtext}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block focus:outline-hidden">
        {content}
      </Link>
    );
  }

  return content;
}
