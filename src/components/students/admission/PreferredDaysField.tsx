"use client";

import { CalendarDays } from "lucide-react";
import { WEEKDAYS, dayList, sortDays } from "@/lib/preferred-days";

/** Shown where staff choose trainers and class times. */
export function PreferredDaysNote({ days, className = "" }: { days: number[]; className?: string }) {
  if (!days.length) return null;
  return (
    <p className={`flex items-start gap-2 rounded-card border border-info/40 bg-info/10 p-3 text-sm text-ink ${className}`}>
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Preferred days (not confirmed):</strong> {dayList(days)}
      </span>
    </p>
  );
}

/** Monday–Sunday tick boxes for the days that usually suit a student (a preference, never a booking). */
export function PreferredDaysField({
  days,
  onChange,
  error,
  className = "",
}: {
  days: number[];
  onChange: (days: number[]) => void;
  error?: string;
  className?: string;
}) {
  const toggle = (day: number, checked: boolean) => onChange(sortDays(checked ? [...days, day] : days.filter((d) => d !== day)));
  return (
    <fieldset
      data-field="preferredDays"
      tabIndex={-1}
      aria-describedby={error ? "preferred-days-hint preferred-days-error" : "preferred-days-hint"}
      className={`focus:outline-none ${className}`}
    >
      <legend className="mb-1 text-sm font-semibold text-ink-muted">Preferred class days (optional)</legend>
      <p id="preferred-days-hint" className="mb-2 text-xs text-ink-subtle">
        Days that usually suit the student, for any subject. Not a booking: class times are set in the weekly timetable.
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WEEKDAYS.map((d) => {
          const checked = days.includes(d.value);
          return (
            <li key={d.value}>
              <label
                className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-control border px-3 py-2 text-sm ${
                  checked ? "border-brand bg-brand/10 text-ink" : "border-line-strong bg-raised text-ink-muted"
                }`}
              >
                <input type="checkbox" checked={checked} onChange={(e) => toggle(d.value, e.target.checked)} className="h-5 w-5 shrink-0 accent-teal-400" />
                {d.label}
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p id="preferred-days-error" className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
