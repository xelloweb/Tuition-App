"use client";

import React, { useId } from "react";
import { AlertCircle } from "lucide-react";

/** Shared look for text inputs, selects and text areas (44px tall, visible boundary, clear focus). */
export const controlClass =
  "w-full min-h-[44px] rounded-control border bg-raised px-3 py-2 text-base sm:text-sm text-ink placeholder:text-ink-subtle/70 focus:outline-none focus:ring-2 focus:ring-brand/60 disabled:opacity-60";

export function controlBorder(invalid: boolean) {
  return invalid ? "border-rose-400 focus:border-rose-300" : "border-line-strong focus:border-brand";
}

type FieldRenderProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  "data-field"?: string;
};

/**
 * Label + control + hint + error, wired together: the label targets the
 * control, and the hint and error are announced with it.
 */
export function Field({
  label,
  name,
  required,
  hint,
  error,
  className = "",
  children,
}: {
  label: React.ReactNode;
  name?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink-muted">
        {label}
        {required ? (
          <span className="text-danger"> *<span className="sr-only"> (required)</span></span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, "data-field": name })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 flex items-start gap-1 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
