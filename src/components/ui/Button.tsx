import React from "react";
import { Loader2, LucideIcon } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  children?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconPosition = "left",
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-bold rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

  const sizeStyles = {
    sm: "min-h-[38px] px-3.5 py-1.5 text-xs gap-1.5",
    md: "min-h-[44px] px-4 py-2.5 text-xs sm:text-sm gap-2",
    lg: "min-h-[48px] px-5 py-3 text-sm gap-2.5",
  }[size];

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-black shadow-lg shadow-teal-500/20 border border-teal-300/30",
    secondary:
      "bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700/80 shadow-md",
    outline:
      "border border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/80 hover:text-white shadow-xs",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/25 border border-rose-500/30",
    ghost:
      "text-slate-400 hover:bg-slate-800/60 hover:text-white",
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : Icon && iconPosition === "left" ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}

      {children}

      {!loading && Icon && iconPosition === "right" && (
        <Icon className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}
