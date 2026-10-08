"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";

export interface SlotDraft {
  key: string;
  subjectId: string;
  /** "" = the subject's assigned trainer. */
  teacherId: string;
  weekday: string;
  start: string;
  end: string;
}

export const WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const weekdayLabel = (value: string) => WEEKDAY_OPTIONS.find((d) => d.value === value)?.label ?? "Day";

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** "18:30" → "6:30 PM" */
export function displayTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm || "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

let slotCounter = 0;
export const newSlotKey = () => `slot-${Date.now().toString(36)}-${(slotCounter++).toString(36)}`;

export interface PackageSummary {
  includePackage: boolean;
  packageName: string;
  totalCredits: number;
}

interface SubjectRow {
  key: string;
  subjectId: string;
  teacherId: string;
}

export function WeeklyScheduleStep({
  rows,
  subjectName,
  teacherName,
  teachers,
  slots,
  setSlots,
  slotError,
  clearSlotErrors,
  classMinutes,
  packageInfo,
  preferences,
}: {
  rows: SubjectRow[];
  subjectName: (subjectId: string) => string;
  teacherName: (teacherId: string) => string | null;
  teachers: { id: string; name: string }[];
  slots: SlotDraft[];
  setSlots: (update: (prev: SlotDraft[]) => SlotDraft[]) => void;
  /** Server error for a slot field, by the slot's position in the saved list. */
  slotError: (index: number, field: "weekday" | "start" | "end" | "teacherId" | "enrolmentId") => string | undefined;
  clearSlotErrors: (index: number) => void;
  classMinutes: number;
  packageInfo?: PackageSummary | null;
  /** Times a parent suggested on the public form (IST). Shown for reference; never booked by themselves. */
  preferences?: { subjectId: string; subjectName: string; weekday: number; start: string; end: string }[] | null;
}) {
  const update = (key: string, patch: Partial<SlotDraft>) => {
    const index = slots.findIndex((s) => s.key === key);
    if (index >= 0) clearSlotErrors(index);
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const changeStart = (slot: SlotDraft, start: string) => {
    const oldStart = toMinutes(slot.start);
    const oldEnd = toMinutes(slot.end);
    const newStart = toMinutes(start);
    // Keep the class length when the end time was following the start time.
    const followsStart = oldStart !== null && oldEnd !== null && oldEnd - oldStart === classMinutes;
    update(slot.key, { start, ...(followsStart && newStart !== null ? { end: fromMinutes(newStart + classMinutes) } : {}) });
  };

  const addSlot = (row: SubjectRow) => {
    setSlots((prev) => {
      const mine = prev.filter((s) => s.subjectId === row.subjectId);
      const last = mine[mine.length - 1];
      const weekday = last ? String((Number(last.weekday) + 2) % 7) : "1";
      const start = last?.start ?? "18:00";
      const startMin = toMinutes(start) ?? 18 * 60;
      return [...prev, { key: newSlotKey(), subjectId: row.subjectId, teacherId: "", weekday, start, end: last?.end ?? fromMinutes(startMin + classMinutes) }];
    });
  };

  const addFromPreference = (row: SubjectRow, pref: { weekday: number; start: string }) => {
    const startMin = toMinutes(pref.start) ?? 18 * 60;
    setSlots((prev) => [
      ...prev,
      { key: newSlotKey(), subjectId: row.subjectId, teacherId: "", weekday: String(pref.weekday), start: fromMinutes(startMin), end: fromMinutes(startMin + classMinutes) },
    ]);
  };

  const subjectRows = rows.filter((r) => r.subjectId);
  if (subjectRows.length === 0) {
    return <p className="text-sm text-ink-muted">Add a subject first; weekly slots are set per subject.</p>;
  }

  const weeklyTarget = packageInfo?.includePackage && packageInfo.totalCredits > 0
    ? Math.max(1, Math.round(packageInfo.totalCredits / 4))
    : null;
  const currentWeeklyCount = slots.length;

  return (
    <div className="space-y-4">
      {packageInfo?.includePackage && packageInfo.totalCredits > 0 && (
        <div className="rounded-card border border-teal-500/25 bg-teal-500/5 p-3.5 sm:p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <h4 className="font-semibold text-sm text-ink">
                Selected Package: <span className="text-teal-400">{packageInfo.packageName || "Monthly Package"}</span>
              </h4>
            </div>
            <span className="text-xs font-mono font-semibold rounded-full bg-surface px-2.5 py-1 border border-line text-ink">
              {packageInfo.totalCredits} classes/month (~{weeklyTarget} classes/week)
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-ink-muted">
              Configured recurring schedule: <strong className="text-ink">{currentWeeklyCount} class{currentWeeklyCount === 1 ? "" : "es"} per week</strong> ({currentWeeklyCount * 4} classes/month)
            </p>
            {weeklyTarget !== null && (
              currentWeeklyCount === weeklyTarget ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  ✓ Matches weekly package limit ({currentWeeklyCount} / {weeklyTarget} classes/week)
                </span>
              ) : currentWeeklyCount < weeklyTarget ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                  {currentWeeklyCount} of {weeklyTarget} weekly classes configured ({weeklyTarget - currentWeeklyCount} more recommended)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                  ⚠ {currentWeeklyCount} weekly classes ({currentWeeklyCount * 4}/month) exceeds {packageInfo.totalCredits} monthly package limit
                </span>
              )
            )}
          </div>
        </div>
      )}

      {preferences && preferences.length > 0 && (
        <section aria-labelledby="parent-preferences-heading" className="space-y-2 rounded-card border border-info/40 bg-info/10 p-3 sm:p-4">
          <h4 id="parent-preferences-heading" className="font-semibold text-ink">Parent&apos;s preferred times (not confirmed)</h4>
          <p className="text-sm text-ink-muted">
            From the parent form, in IST. Nothing is booked from these: check the trainer&apos;s availability, then add a slot.
          </p>
          <ul className="space-y-2">
            {preferences.map((pref, i) => {
              const row = subjectRows.find((r) => r.subjectId === pref.subjectId);
              return (
                <li key={`${pref.subjectId}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                  <span>
                    {pref.subjectName}: {weekdayLabel(String(pref.weekday))}, {displayTime(pref.start)} to {displayTime(pref.end)} IST
                  </span>
                  {row ? (
                    <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => addFromPreference(row, pref)}>
                      Add as a slot
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-subtle">Subject not in this admission</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-sm text-ink-muted">
        Configure recurring weekly classes across any selected enrolled subjects. Classes repeat automatically every week in <strong className="text-ink">IST</strong> and are tracked against the monthly package.
      </p>
      {subjectRows.map((row) => {
        const assigned = row.teacherId ? teacherName(row.teacherId) : null;
        const entries = slots.map((slot, index) => ({ slot, index })).filter((e) => e.slot.subjectId === row.subjectId);
        const headingId = `schedule-${row.key}`;
        return (
          <section key={row.key} aria-labelledby={headingId} className="space-y-3 rounded-card border border-line bg-canvas/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 id={headingId} className="font-semibold text-ink">{subjectName(row.subjectId)}</h3>
                  <span className="text-xs rounded-full bg-surface px-2 py-0.5 border border-line text-ink-subtle">
                    {entries.length} weekly slot{entries.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-sm text-ink-subtle">
                  {assigned ? `Trainer: ${assigned}` : "No trainer assigned yet: classes are booked once a trainer is set."}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => addSlot(row)}>
                {entries.length ? "Add another slot" : "Add a slot"}
              </Button>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-ink-subtle">No weekly slots yet for {subjectName(row.subjectId)}.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map(({ slot, index }) => {
                  const generalError = slotError(index, "enrolmentId");
                  // Start-time problems are clashes and overlaps: long messages, shown across the row.
                  const startError = slotError(index, "start");
                  return (
                    <li key={slot.key} className="rounded-control border border-line p-3" data-field={`slots.${index}.start`} tabIndex={-1}>
                      <div className="mb-2 flex items-center justify-between text-xs text-ink-subtle">
                        <span className="font-medium text-ink">
                          {weekdayLabel(slot.weekday)} · {displayTime(slot.start)} to {displayTime(slot.end)} IST
                        </span>
                        <span className="text-ink-muted">Repeats weekly</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1.5fr_auto] sm:items-start">
                        <Field label="Day" error={slotError(index, "weekday")}>
                          {(p) => (
                            <select {...p} value={slot.weekday} onChange={(e) => update(slot.key, { weekday: e.target.value })} className={`${controlClass} ${controlBorder(!!slotError(index, "weekday"))}`}>
                              {WEEKDAY_OPTIONS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                          )}
                        </Field>
                        <Field label="Starts (IST)">
                          {(p) => (
                            <input
                              {...p}
                              type="time"
                              step={300}
                              value={slot.start}
                              aria-invalid={!!startError}
                              aria-describedby={startError ? `${slot.key}-clash` : p["aria-describedby"]}
                              onChange={(e) => changeStart(slot, e.target.value)}
                              className={`${controlClass} ${controlBorder(!!startError)}`}
                            />
                          )}
                        </Field>
                        <Field label="Ends (IST)" error={slotError(index, "end")}>
                          {(p) => (
                            <input {...p} type="time" step={300} value={slot.end} onChange={(e) => update(slot.key, { end: e.target.value })} className={`${controlClass} ${controlBorder(!!slotError(index, "end"))}`} />
                          )}
                        </Field>
                        <Field label="Trainer" error={slotError(index, "teacherId")}>
                          {(p) => (
                            <select {...p} value={slot.teacherId} onChange={(e) => update(slot.key, { teacherId: e.target.value })} className={`${controlClass} ${controlBorder(!!slotError(index, "teacherId"))}`}>
                              <option value="">{assigned ? "Subject's trainer" : "Subject's trainer (not set yet)"}</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )}
                        </Field>
                        <div className="col-span-2 flex justify-end sm:col-span-1 sm:pt-6">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            aria-label={`Remove the ${weekdayLabel(slot.weekday)} ${displayTime(slot.start)} slot`}
                            onClick={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                          >
                            <span className="sm:sr-only">Remove</span>
                          </Button>
                        </div>
                      </div>
                      {startError && (
                        <p id={`${slot.key}-clash`} className="mt-2 text-sm font-medium text-danger">
                          {startError}
                        </p>
                      )}
                      {generalError && <p className="mt-2 text-sm font-medium text-danger">{generalError}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
