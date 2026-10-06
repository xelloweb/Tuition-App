"use client";

import { AlertCircle } from "lucide-react";

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-medium text-rose-300">
      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Form-level error banner. Lists field problems so they are visible even when
 * the offending field is scrolled out of view on a phone.
 */
export function FormErrorSummary({
  message,
  fieldErrors = {},
  labels = {},
  onFocusField,
}: {
  message?: string | null;
  fieldErrors?: Record<string, string>;
  labels?: Record<string, string>;
  onFocusField?: (field: string) => void;
}) {
  const entries = Object.entries(fieldErrors);
  if (!message && entries.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-2xl bg-rose-950/40 border border-rose-500/30 p-3.5 text-xs text-rose-200 space-y-1.5"
    >
      <div className="flex items-start gap-2 font-semibold">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
        <span>{message || "Please correct the highlighted fields."}</span>
      </div>
      {entries.length > 0 && (
        <ul className="list-disc pl-8 space-y-0.5 text-[11px] text-rose-300">
          {entries.map(([field, msg]) => (
            <li key={field}>
              {onFocusField ? (
                <button type="button" className="underline underline-offset-2 text-left" onClick={() => onFocusField(field)}>
                  {labels[field] ? `${labels[field]}: ` : ""}
                  {msg}
                </button>
              ) : (
                <>
                  {labels[field] ? `${labels[field]}: ` : ""}
                  {msg}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tailwind classes for an input, highlighted when invalid. */
export function inputClass(base: string, invalid: boolean): string {
  return `${base} ${invalid ? "border-rose-500/70 focus:border-rose-400" : "border-slate-700 focus:border-teal-400"}`;
}

/** Scrolls to and focuses the element registered for a field (data-field attribute). */
export function focusField(container: HTMLElement | null, field: string) {
  const el = container?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
