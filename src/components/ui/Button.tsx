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
    "inline-flex items-center justify-center font-semibold rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-hover focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60 disabled:cursor-not-allowed select-none";

  // Every size keeps a 44px touch target; "sm" is only visually tighter.
  const sizeStyles = {
    sm: "min-h-[44px] px-3 py-2 text-sm gap-1.5",
    md: "min-h-[44px] px-4 py-2.5 text-sm gap-2",
    lg: "min-h-[48px] px-5 py-3 text-base gap-2.5",
  }[size];

  const variantStyles = {
    primary: "bg-brand text-brand-ink hover:bg-brand-hover",
    secondary: "bg-raised text-ink border border-line-strong hover:bg-slate-700",
    outline: "border border-line-strong bg-transparent text-ink hover:bg-raised",
    danger: "bg-rose-500 text-white hover:bg-rose-400",
    ghost: "text-ink-muted hover:bg-raised hover:text-ink",
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      ) : Icon && iconPosition === "left" ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}

      {children}

      {!loading && Icon && iconPosition === "right" && (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
