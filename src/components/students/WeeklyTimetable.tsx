"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Undo2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  CalendarPlus,
  X,
} from "lucide-react";
import {
  WEEKDAYS,
  describeInZone,
  formatMinutes,
  minutesToTimeInput,
  parseTimeOfDay,
  slotInZone,
} from "@/lib/zoned-time";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { FieldError } from "@/components/ui/FormFeedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TimetableView } from "@/lib/services/timetable";
import type { TeacherOption } from "./StudentFormModal";
import { TrainerAvailabilityPanel, useTrainerWeeks } from "@/components/teachers/TrainerWeekView";
import { findWeeklyOverlap, overlapMessage } from "@/lib/trainer-week";

interface SlotDraft {
  key: string;
  id: string | null;
  enrolmentId: string;
  teacherId: string; // "" = use the subject's assigned trainer
  weekday: string;
  start: string;
  end: string;
  removed: boolean;
  editing: boolean;
}

interface PreviewResult {
  summary: { added: number; edited: number; removed: number; unchanged: number; released: number; toBook: number };
  released: { start: string; subjectName: string; teacherName: string }[];
  toBook: { start: string; date: string; subjectName: string; teacherName: string; packageNumber: string }[];
  issues: { reason: string; subjectName: string; count: number; firstDate: string; message: string }[];
  removed: { subjectName: string; mode: string; label: string }[];
  versioned: number;
}

interface WeeklyTimetableProps {
  studentId: string;
  view: TimetableView;
  teachers: TeacherOption[];
  canEdit: boolean;
  /** Kept for older callers; times are always IST. */
  viewerTimeZone?: string;
  onSaved: (message: string) => void;
}

let draftCounter = 0;
const newKey = () => `draft-${Date.now().toString(36)}-${(draftCounter++).toString(36)}`;

const IST = "Asia/Kolkata";

/** Slots are edited in IST; slots saved earlier in another zone are shown at the same moment in IST. */
function fromView(view: TimetableView): SlotDraft[] {
  return view.slots.map((s) => {
    const t = view.timeZone === IST ? s : slotInZone({ ...s, timeZone: view.timeZone }, IST);
    return {
      key: s.id,
      id: s.id,
      enrolmentId: s.enrolmentId,
      teacherId: s.teacherId ?? "",
      weekday: String(t.weekday),
      start: minutesToTimeInput(t.startMinutes),
      end: minutesToTimeInput(t.endMinutes),
      removed: false,
      editing: false,
    };
  });
}

const fieldBase =
  "w-full rounded-xl border bg-slate-950 px-2.5 py-2 min-h-[44px] text-base sm:text-sm text-white focus:outline-hidden";

export function WeeklyTimetable({ studentId, view, teachers, canEdit, onSaved }: WeeklyTimetableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // India time only: the timetable is edited and saved in IST.
  const timeZone = IST;
  const legacyZone = view.timeZone !== IST ? view.timeZone : null;
  const baseline = useMemo(() => new Map(fromView(view).map((d) => [d.id, d])), [view]);
  const [drafts, setDrafts] = useState<SlotDraft[]>(() => fromView(view));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | "generate" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const enrolmentById = useMemo(() => new Map(view.enrolments.map((e) => [e.id, e])), [view.enrolments]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const original = useMemo(() => new Map(view.slots.map((s) => [s.id, s])), [view.slots]);

  // Each subject trainer's week without this student: shown while choosing times,
  // and used to warn about an overlap as soon as a time is entered.
  const { weeks: trainerWeeks, errors: trainerWeekErrors } = useTrainerWeeks(
    canEdit ? view.enrolments.map((e) => e.teacherId ?? "") : [],
    studentId
  );
  const trainerClash = (d: SlotDraft): string | null => {
    const enr = enrolmentById.get(d.enrolmentId);
    const teacherId = d.teacherId || enr?.teacherId || "";
    const week = teacherId ? trainerWeeks[teacherId] : undefined;
    const start = parseTimeOfDay(d.start);
    const end = parseTimeOfDay(d.end);
    if (!week || start === null || end === null || end <= start) return null;
    const booked = findWeeklyOverlap(week.slots, { weekday: Number(d.weekday), startMinutes: start, endMinutes: end });
    return booked ? overlapMessage(week.trainer.name, booked) : null;
  };

  const liveDrafts = drafts.filter((d) => !d.removed);
  const isDirty =
    drafts.some((d) => {
      if (!d.id) return !d.removed;
      if (d.removed) return true;
      const o = baseline.get(d.id);
      return !o || o.enrolmentId !== d.enrolmentId || o.teacherId !== d.teacherId || o.weekday !== d.weekday || o.start !== d.start || o.end !== d.end;
    });

  // Server field errors are keyed by the index in the submitted list.
  const errorFor = (draft: SlotDraft, field: string) => {
    const index = liveDrafts.findIndex((d) => d.key === draft.key);
    return index >= 0 ? fieldErrors[`slots.${index}.${field}`] : undefined;
  };

  const trainerName = (draft: SlotDraft) => {
    return enrolmentById.get(draft.enrolmentId)?.teacherName ?? null;
  };

  const update = (key: string, patch: Partial<SlotDraft>) => {
    // The server's message for this slot no longer applies once it is changed;
    // the instant trainer check shows any new clash straight away.
    const index = liveDrafts.findIndex((d) => d.key === key);
    if (index >= 0) {
      setFieldErrors((prev) => {
        const prefix = `slots.${index}.`;
        if (!Object.keys(prev).some((k) => k.startsWith(prefix))) return prev;
        return Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix)));
      });
    }
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setPreview(null);
  };

  const addSlot = (enrolmentId: string) => {
    const siblings = liveDrafts.filter((d) => d.enrolmentId === enrolmentId);
    const last = siblings[siblings.length - 1];
    setDrafts((prev) => [
      ...prev,
      {
        key: newKey(),
        id: null,
        enrolmentId,
        teacherId: enrolmentById.get(enrolmentId)?.teacherId ?? "",
        weekday: last ? String((Number(last.weekday) + 1) % 7) : "1",
        start: last?.start ?? "18:00",
        end: last?.end ?? "19:00",
        removed: false,
        editing: true,
      },
    ]);
    setPreview(null);
  };

  const removeSlot = (draft: SlotDraft) => {
    if (!draft.id) setDrafts((prev) => prev.filter((d) => d.key !== draft.key));
    else update(draft.key, { removed: true, editing: false });
  };

  const resetAll = () => {
    setDrafts(fromView(view));
    setFieldErrors({});
    setFormError("");
    setPreview(null);
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    liveDrafts.forEach((d, i) => {
      const start = parseTimeOfDay(d.start);
      const end = parseTimeOfDay(d.end);
      if (!d.enrolmentId) errors[`slots.${i}.enrolmentId`] = "Choose a subject.";
      if (d.weekday === "") errors[`slots.${i}.weekday`] = "Choose a day.";
      if (start === null) errors[`slots.${i}.start`] = "Enter a start time.";
      if (end === null) errors[`slots.${i}.end`] = "Enter an end time.";
      if (start !== null && end !== null && end <= start) {
        errors[`slots.${i}.end`] = "End must be after start on the same day. Split overnight classes into two entries.";
      }
      if (errors[`slots.${i}.start`] || errors[`slots.${i}.end`] || start === null || end === null) return;
      for (let j = 0; j < i; j++) {
        const o = liveDrafts[j];
        const os = parseTimeOfDay(o.start);
        const oe = parseTimeOfDay(o.end);
        if (os === null || oe === null || o.weekday !== d.weekday) continue;
        const name = enrolmentById.get(o.enrolmentId)?.subjectName ?? "another subject";
        if (o.enrolmentId === d.enrolmentId && os === start && oe === end) {
          errors[`slots.${i}.start`] = `Duplicate of another ${name} slot.`;
          break;
        }
        if (start < oe && os < end) {
          errors[`slots.${i}.start`] = `Overlaps ${name} (${formatMinutes(os)}–${formatMinutes(oe)}).`;
          break;
        }
      }
    });
    return errors;
  };

  const payload = () => ({
    timeZone,
    slots: liveDrafts.map((d) => ({
      id: d.id ?? undefined,
      enrolmentId: d.enrolmentId,
      teacherId: enrolmentById.get(d.enrolmentId)?.teacherId ?? null,
      weekday: Number(d.weekday),
      start: d.start,
      end: d.end,
    })),
  });

  /** Opens every slot that has an error so the message is visible beside it. */
  const openSlotsWithErrors = (errors: Record<string, string>) => {
    const badIndexes = new Set(Object.keys(errors).map((k) => Number(k.split(".")[1])));
    setDrafts((prev) => {
      let i = -1;
      return prev.map((d) => {
        if (d.removed) return d;
        i++;
        return badIndexes.has(i) ? { ...d, editing: true } : d;
      });
    });
  };

  const handleError = (err: unknown) => {
    const apiErr = err instanceof ClientApiError ? err : null;
    setFieldErrors(apiErr?.fieldErrors ?? {});
    setFormError(errorMessage(err, "Could not update the timetable."));
    if (apiErr?.fieldErrors) openSlotsWithErrors(apiErr.fieldErrors);
  };

  const runPreview = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError("Some slots need attention.");
      openSlotsWithErrors(errors);
      return;
    }
    setBusy("preview");
    setFormError("");
    try {
      const data = await apiRequest<{ preview: PreviewResult }>(`/api/students/${studentId}/timetable`, {
        method: "POST",
        body: { ...payload(), previewOnly: true },
      });
      setPreview(data.preview);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const confirmSave = async () => {
    if (busy) return;
    setBusy("save");
    setFormError("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/students/${studentId}/timetable`, {
        method: "POST",
        body: payload(),
      });
      setPreview(null);
      setNotice({ tone: "success", text: data.message });
      onSaved(data.message);
    } catch (err) {
      setPreview(null);
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (busy) return;
    setBusy("generate");
    try {
      const data = await apiRequest<{ message: string }>(`/api/students/${studentId}/timetable/generate`, { method: "POST" });
      setNotice({ tone: "success", text: data.message });
      onSaved(data.message);
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const agenda = [...liveDrafts]
    .filter((d) => parseTimeOfDay(d.start) !== null && parseTimeOfDay(d.end) !== null)
    .sort((a, b) => Number(a.weekday) - Number(b.weekday) || a.start.localeCompare(b.start));


  return (
    <div ref={containerRef} className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-teal-400" />
            Weekly Timetable
          </h3>
          <p className="mt-1 text-sm text-slate-300">All times are in IST (India Standard Time).</p>
          {legacyZone && (
            <p className="mt-1 text-sm text-amber-200">
              This timetable was set up in {legacyZone} time. It is shown here in IST at the same moments; saving any change stores it in IST.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        The weekly timetable is a template: it does not use package credits. Classes are booked from it up to {view.windowDays} days
        ahead, only while an active package has unreserved classes for that subject. Changes apply from now on — past classes,
        attendance and individually cancelled or rescheduled classes are never changed.
      </p>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-2 rounded-2xl border p-3 text-xs font-semibold ${
            notice.tone === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <span className="flex items-start gap-2">
            {notice.tone === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {notice.text}
          </span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1 shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {formError && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{formError} {Object.keys(fieldErrors).length > 0 && "Details are shown beside each slot."}</span>
        </div>
      )}

      {view.enrolments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
          Enrol the student in a subject first; weekly slots are added per subject.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {view.enrolments.map((enr) => {
            const subjectDrafts = drafts.filter((d) => d.enrolmentId === enr.id);
            return (
              <section key={enr.id} aria-label={`${enr.subjectName} weekly slots`} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: enr.subjectColor || "#14b8a6" }} />
                      <h4 className="font-bold text-sm text-white truncate">{enr.subjectName}</h4>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Assigned Trainer:</span>
                      {enr.teacherName ? (
                        <span className={`font-semibold ${enr.teacherActive ? "text-teal-300" : "text-amber-300"}`}>
                          {enr.teacherName}{enr.teacherActive ? "" : " (inactive)"}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-300 border border-amber-500/20">
                          Trainer Not Assigned
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{subjectDrafts.filter((d) => !d.removed).length} slot(s)</span>
                </div>
                {canEdit && enr.teacherId && (
                  <TrainerAvailabilityPanel
                    trainerName={enr.teacherName ?? "Trainer"}
                    schedule={trainerWeeks[enr.teacherId]}
                    error={trainerWeekErrors[enr.teacherId]}
                  />
                )}

                <ul className="space-y-2">
                  {subjectDrafts.length === 0 && <li className="text-xs text-slate-400 italic">No weekly slots yet.</li>}
                  {subjectDrafts.map((d) => {
                    const start = parseTimeOfDay(d.start);
                    const end = parseTimeOfDay(d.end);
                    const slotErrors = ["enrolmentId", "weekday", "start", "end", "id"]
                      .map((f) => errorFor(d, f))
                      .filter(Boolean) as string[];
                    const isNew = !d.id;

                    if (d.removed) {
                      return (
                        <li key={d.key} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-200">
                          <span className="line-through">
                            {WEEKDAYS[Number(d.weekday)]?.long} {start !== null ? formatMinutes(start) : d.start}–{end !== null ? formatMinutes(end) : d.end}
                          </span>
                          <button type="button" onClick={() => update(d.key, { removed: false })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 min-h-[44px] font-bold hover:bg-rose-500/10">
                            <Undo2 className="h-3.5 w-3.5" /> Undo
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={d.key} className={`rounded-xl border p-2.5 space-y-2 ${slotErrors.length ? "border-rose-500/50 bg-rose-950/20" : "border-slate-800 bg-slate-950/60"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-xs">
                            <div className="font-bold text-white">
                              {WEEKDAYS[Number(d.weekday)]?.long ?? "Choose a day"} ·{" "}
                              {start !== null ? formatMinutes(start) : "--"}–{end !== null ? formatMinutes(end) : "--"}
                              {isNew && <span className="ml-1.5 rounded bg-teal-500/20 px-1.5 py-0.5 text-xs text-teal-200">new</span>}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => update(d.key, { editing: !d.editing })}
                                aria-label="Edit slot"
                                aria-expanded={d.editing}
                                className="rounded-lg p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                              >
                                <Pencil className="h-3.5 w-3.5 text-teal-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSlot(d)}
                                aria-label="Remove slot"
                                className="rounded-lg p-2 min-h-[44px] min-w-[44px] flex items-center justify-center border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {canEdit && d.editing && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <label className="block text-xs text-slate-400 sm:col-span-2">
                              Day (Sunday to Saturday)
                              <select
                                value={d.weekday}
                                onChange={(e) => update(d.key, { weekday: e.target.value })}
                                className={`${fieldBase} mt-1 ${errorFor(d, "weekday") ? "border-rose-500/70" : "border-slate-700"}`}
                              >
                                {WEEKDAYS.map((w) => (
                                  <option key={w.value} value={String(w.value)} className="bg-slate-900">{w.long}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-xs text-slate-400">
                              Start Time (IST)
                              <input
                                type="time"
                                value={d.start}
                                step={300}
                                onChange={(e) => update(d.key, { start: e.target.value })}
                                className={`${fieldBase} mt-1 ${errorFor(d, "start") ? "border-rose-500/70" : "border-slate-700"}`}
                              />
                            </label>
                            <label className="block text-xs text-slate-400">
                              End Time (IST)
                              <input
                                type="time"
                                value={d.end}
                                step={300}
                                onChange={(e) => update(d.key, { end: e.target.value })}
                                className={`${fieldBase} mt-1 ${errorFor(d, "end") ? "border-rose-500/70" : "border-slate-700"}`}
                              />
                            </label>
                          </div>
                        )}
                        {slotErrors.map((m) => (
                          <FieldError key={m} message={m} />
                        ))}
                        {(() => {
                          const clashText = slotErrors.length ? null : trainerClash(d);
                          return clashText ? (
                            <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-sm font-medium text-danger">
                              {clashText}
                            </p>
                          ) : null;
                        })()}
                      </li>
                    );
                  })}
                </ul>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => addSlot(enr.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-teal-500/40 bg-teal-500/5 py-2.5 min-h-[44px] text-xs font-bold text-teal-300 hover:bg-teal-500/10"
                  >
                    <Plus className="h-4 w-4" /> Add Another Slot
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {canEdit && isDirty && !preview && (
        <div className="sticky bottom-24 lg:bottom-4 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded-2xl border border-teal-500/30 bg-[#0c1220]/95 p-3 shadow-2xl">
          <span className="text-xs text-teal-200 font-semibold">You have unsaved timetable changes.</span>
          <div className="flex gap-2">
            <button type="button" onClick={resetAll} className="flex-1 sm:flex-none rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800">
              Discard
            </button>
            <button
              type="button"
              onClick={runPreview}
              disabled={busy !== null}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2 min-h-[44px] text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {busy === "preview" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-4 w-4" />}
              Review &amp; save changes
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div role="region" aria-label="Review timetable changes" className="rounded-2xl border border-teal-500/40 bg-teal-950/20 p-4 space-y-3 text-xs">
          <h4 className="font-bold text-white">Review before saving</h4>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ["Slots added", preview.summary.added],
              ["Slots edited", preview.summary.edited],
              ["Slots removed", preview.summary.removed],
              ["Classes to book", preview.summary.toBook],
            ].map(([label, value]) => (
              <li key={label as string} className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </li>
            ))}
          </ul>
          {preview.released.length > 0 && (
            <div>
              <p className="font-semibold text-amber-200">
                {preview.released.length} upcoming class(es) will be released (their reserved credits return to the package):
              </p>
              <ul className="mt-1 space-y-0.5 text-slate-300">
                {preview.released.slice(0, 8).map((r) => {
                  const local = describeInZone(new Date(r.start), timeZone);
                  return (
                    <li key={r.start + r.subjectName}>
                      {local.localDate} {local.weekdayShort} {local.time} — {r.subjectName} with {r.teacherName}
                    </li>
                  );
                })}
                {preview.released.length > 8 && <li>…and {preview.released.length - 8} more</li>}
              </ul>
            </div>
          )}
          {preview.toBook.length > 0 && (
            <div>
              <p className="font-semibold text-teal-200">Classes that will be booked (next {view.windowDays} days):</p>
              <ul className="mt-1 space-y-0.5 text-slate-300">
                {preview.toBook.slice(0, 8).map((b) => {
                  const local = describeInZone(new Date(b.start), timeZone);
                  return (
                    <li key={b.start + b.subjectName}>
                      {b.date} {local.weekdayShort} {local.time} — {b.subjectName} with {b.teacherName} · {b.packageNumber}
                    </li>
                  );
                })}
                {preview.toBook.length > 8 && <li>…and {preview.toBook.length - 8} more</li>}
              </ul>
            </div>
          )}
          {preview.versioned > 0 && (
            <p className="text-slate-400">
              {preview.versioned} edited slot(s) have class history; they are saved as a new version so past records stay linked to the old times.
            </p>
          )}
          {preview.issues.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <p className="font-semibold text-amber-200 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Not booked — needs action</p>
              <ul className="space-y-0.5 text-amber-100/90">
                {preview.issues.map((i) => (
                  <li key={i.reason + i.subjectName + i.firstDate + i.message}>
                    {i.message}{i.count > 1 && i.reason !== "CONFLICT" ? ` (${i.count} classes)` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-1">
            <button type="button" onClick={() => setPreview(null)} className="rounded-xl px-4 py-2 min-h-[44px] font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800">
              Back to editing
            </button>
            <button
              type="button"
              onClick={confirmSave}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2 min-h-[44px] font-bold text-slate-950 disabled:opacity-50"
            >
              {busy === "save" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm &amp; save timetable
            </button>
          </div>
        </div>
      )}

      {/* Weekly overview (agenda) */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-teal-400" /> Weekly overview
        </h4>
        {agenda.length === 0 ? (
          <p className="text-xs text-slate-400">No weekly slots yet.</p>
        ) : (
          <ol className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-950/40">
            {agenda.map((d) => {
              const start = parseTimeOfDay(d.start)!;
              const end = parseTimeOfDay(d.end)!;
              const enr = enrolmentById.get(d.enrolmentId);
              return (
                <li key={d.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-2.5 text-xs">
                  <span className="font-bold text-white w-24 shrink-0">{WEEKDAYS[Number(d.weekday)]?.long}</span>
                  <span className="font-mono text-teal-300 sm:w-40 shrink-0">{formatMinutes(start)}–{formatMinutes(end)}</span>
                  <span className="flex items-center gap-1.5 text-slate-200 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: enr?.subjectColor || "#14b8a6" }} />
                    <span className="truncate">{enr?.subjectName} · {trainerName(d) ?? "no trainer"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Booking status */}
      {view.issues.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1 text-xs">
          <p className="font-semibold text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Classes that could not be booked
          </p>
          <ul className="space-y-0.5 text-amber-100/90">
            {view.issues.map((i) => (
              <li key={i.reason + i.subjectName + i.firstDate + i.message}>
                {i.message}{i.count > 1 && i.reason !== "CONFLICT" ? ` (${i.count} classes in the next ${view.windowDays} days)` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Booked classes from the timetable (next {view.windowDays} days)
          </h4>
          {canEdit && view.slots.length > 0 && (
            <button
              type="button"
              onClick={generate}
              disabled={busy !== null || isDirty}
              title={isDirty ? "Save or discard timetable changes first" : "Books any missing classes; safe to repeat"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 min-h-[44px] text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {busy === "generate" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5 text-teal-400" />}
              Book next {view.windowDays} days{view.pendingBookings ? ` (${view.pendingBookings} pending)` : ""}
            </button>
          )}
        </div>
        {view.upcoming.length === 0 ? (
          <p className="text-xs text-slate-400">No classes booked from the weekly timetable yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800">
            {view.upcoming.map((u) => {
              const local = describeInZone(new Date(u.start), IST);
              return (
                <li key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-white">
                      {local.localDate} {local.weekdayShort} {local.time} IST
                    </span>
                    <div className="text-xs text-slate-400 truncate">
                      {u.subjectName} · {u.teacherName} · {u.packageNumber}
                    </div>
                  </div>
                  <StatusBadge status={u.status} size="sm" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
