import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 backdrop-blur-xl ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/90 border border-slate-700/80 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
        <Icon className="h-7 w-7 text-teal-400" />
      </div>
      <h3 className="mt-4 text-base font-extrabold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-slate-400 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
