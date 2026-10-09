"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { TrainerWeekDay, rangeLabel } from "@/lib/trainer-week";
import type { TrainerSchedule } from "@/lib/services/trainer-schedule";

/**
 * Loads trainers' weeks for allocation screens. `excludeStudentId` leaves out
 * the student being edited, so their own current slots are not treated as
 * clashes. Data is read fresh each time a screen opens.
 */
export function useTrainerWeeks(teacherIds: string[], excludeStudentId?: string) {
  const [weeks, setWeeks] = useState<Record<string, TrainerSchedule>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const key = [...new Set(teacherIds.filter(Boolean))].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    for (const id of key ? key.split(",") : []) {
      if (weeks[id]) continue;
      const query = excludeStudentId ? `?exclude=${encodeURIComponent(excludeStudentId)}` : "";
      apiRequest<TrainerSchedule>(`/api/teachers/${id}/schedule${query}`)
        .then((s) => !cancelled && setWeeks((prev) => ({ ...prev, [id]: s })))
        .catch((err) => !cancelled && setErrors((prev) => ({ ...prev, [id]: errorMessage(err, "Could not load this trainer's timetable.") })));
    }
    return () => {
      cancelled = true;
    };
    // `weeks` is read only to skip trainers already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, excludeStudentId]);

  return { weeks, errors };
}

/** Monday-to-Sunday list of a trainer's classes with free time. */
export function TrainerWeekView({ week, compact = false }: { week: TrainerWeekDay[]; compact?: boolean }) {
  return (
    <ol className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
      {week.map((day) => (
        <li key={day.weekday} className="rounded-xl border border-line bg-canvas/60 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-sm font-bold text-ink">{day.name}</h4>
            <span className={`text-sm font-semibold ${day.classes.length ? "text-brand-text" : "text-ink-subtle"}`}>
              {day.classes.length ? `${day.classes.length} class${day.classes.length === 1 ? "" : "es"}` : "No classes"}
            </span>
          </div>
          {day.statedAvailable === false && (
            <p className="mt-1 text-xs text-warning">Not one of the trainer&apos;s stated available days.</p>
          )}
          {day.classes.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {day.classes.map((c) => (
                <li key={c.slotId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold tabular-nums text-ink whitespace-nowrap">{rangeLabel(c.startMinutes, c.endMinutes)}</span>
                  <span className="min-w-0 break-words text-ink-muted">
                    {c.studentName} · {c.subjectName}
                    {c.studentStatus !== "ACTIVE" && <span className="text-ink-subtle"> ({c.studentStatus.toLowerCase()})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!compact || day.classes.length > 0 ? (
            <p className="mt-2 text-xs text-ink-subtle">
              <span className="font-semibold text-success">Free:</span>{" "}
              {day.free.length ? day.free.map((f) => rangeLabel(f.startMinutes, f.endMinutes)).join(", ") : "no free time between 6 AM and 11 PM"}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Collapsible "trainer's week" shown while allocating, so staff see booked and
 * free times before choosing a slot.
 */
export function TrainerAvailabilityPanel({
  trainerName,
  schedule,
  error,
}: {
  trainerName: string;
  schedule?: TrainerSchedule;
  error?: string;
}) {
  return (
    <details className="rounded-xl border border-line bg-surface/60 p-3 text-sm">
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold text-ink">
        <CalendarDays className="h-4 w-4 text-brand-text" aria-hidden="true" />
        {trainerName}&apos;s week and free times
        {schedule && (
          <span className="font-normal text-ink-subtle">
            · {schedule.totals.weeklyClasses} weekly class{schedule.totals.weeklyClasses === 1 ? "" : "es"}
          </span>
        )}
      </summary>
      <div className="mt-2 space-y-2">
        {error ? (
          <p className="text-danger">{error}</p>
        ) : !schedule ? (
          <p className="flex items-center gap-2 text-ink-subtle">
            <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" /> Loading the timetable…
          </p>
        ) : (
          <>
            {(schedule.trainer.availableDays || schedule.trainer.availableTimes) && (
              <p className="text-xs text-ink-muted">
                Stated availability: {[schedule.trainer.availableDays, schedule.trainer.availableTimes].filter(Boolean).join(" · ")}
              </p>
            )}
            <TrainerWeekView week={schedule.week} compact />
            <p className="text-xs text-ink-subtle">All times IST. Back-to-back classes are allowed; overlapping ones are not.</p>
          </>
        )}
      </div>
    </details>
  );
}
