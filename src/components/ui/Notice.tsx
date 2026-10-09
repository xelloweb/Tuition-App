import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

type Tone = "success" | "warning" | "error" | "info";

const TONES: Record<Tone, { box: string; icon: typeof Info; label: string }> = {
  success: { box: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100", icon: CheckCircle2, label: "Done" },
  warning: { box: "border-amber-300/40 bg-amber-300/10 text-amber-100", icon: AlertTriangle, label: "Warning" },
  error: { box: "border-rose-400/50 bg-rose-400/10 text-rose-100", icon: XCircle, label: "Error" },
  info: { box: "border-sky-300/40 bg-sky-300/10 text-sky-100", icon: Info, label: "Note" },
};

/**
 * Inline status message. Errors are announced immediately (role="alert"),
 * others politely (role="status"). The tone is also stated in text for
 * screen readers, never by colour alone.
 */
export function Notice({
  tone = "info",
  title,
  children,
  onDismiss,
  className = "",
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-control border p-3 text-sm ${t.box} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">
        <span className="sr-only">{t.label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-m-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
