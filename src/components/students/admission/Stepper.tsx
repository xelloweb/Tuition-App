"use client";

import { Check } from "lucide-react";

export interface StepDef {
  id: string;
  label: string;
}

/**
 * Step indicator for the admission form. Completed steps are buttons (jump back
 * without losing anything); the current step is announced with aria-current.
 */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: StepDef[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Admission steps">
      <p className="mb-2 text-sm text-ink-muted sm:hidden">
        Step {current + 1} of {steps.length}: <span className="font-semibold text-ink">{steps[current].label}</span>
      </p>
      <ol className="hidden gap-2 sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const content = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  active
                    ? "border-brand bg-brand text-brand-ink"
                    : done
                      ? "border-brand text-brand-text"
                      : "border-line-strong text-ink-subtle"
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-left text-sm leading-tight ${active ? "font-semibold text-ink" : "text-ink-muted"}`}>
                {step.label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </>
          );
          return (
            <li key={step.id} aria-current={active ? "step" : undefined}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-control px-1 hover:bg-raised"
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-[44px] items-center gap-2 px-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised sm:hidden" aria-hidden="true">
        <div className="h-full bg-brand" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>
    </nav>
  );
}
