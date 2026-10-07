"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, MessageSquareWarning, X } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { formatInTimeZone } from "@/lib/timezones";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";

type Outcome = "COMPLETED" | "STUDENT_NO_SHOW" | "TEACHER_NO_SHOW" | "CANCELLED";
type Attendance = "PRESENT" | "LATE" | "ABSENT";

interface PendingClass {
  id: string;
  start: string;
  end: string;
  durationMinutes: number;
  student: { name: string; grade: string };
  subject: string;
  trainer: string;
  packageNumber: string;
  noShowCharges: boolean;
  cancellationNoticeHours: number;
  hourlyRate: number | null;
}

interface SubmittedRecord {
  id: string;
  sessionId: string;
  start: string;
  student: string;
  subject: string;
  trainer: string;
  outcome: string;
  attendance: string;
  topic: string;
  homework: string | null;
  minutes: number;
  markedBy: string;
  markedAt: string;
  reversed: boolean;
  openRequest: boolean;
}

interface CorrectionRequestItem {
  id: string;
  recordId: string;
  requestedBy: string;
  reason: string;
  requestedOutcome: string | null;
  requestedAttendance: string | null;
  status: string;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  student: string;
  subject: string;
  trainer: string;
  start: string;
  currentOutcome: string;
  currentAttendance: string;
}

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "COMPLETED", label: "Class completed" },
  { value: "STUDENT_NO_SHOW", label: "Student did not attend" },
  { value: "TEACHER_NO_SHOW", label: "Trainer could not take the class" },
  { value: "CANCELLED", label: "Class cancelled" },
];
const OUTCOME_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  STUDENT_NO_SHOW: "Student absent",
  TEACHER_NO_SHOW: "Trainer absent",
  CANCELLED: "Cancelled",
};
const ATTENDANCE: { value: Attendance; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
];
const DEFAULT_ATTENDANCE: Record<Outcome, Attendance> = {
  COMPLETED: "PRESENT",
  STUDENT_NO_SHOW: "ABSENT",
  TEACHER_NO_SHOW: "PRESENT",
  CANCELLED: "ABSENT",
};

/** What the server will do with the student's package for this outcome (mirrors attendance-ledger). */
function creditEffect(outcome: Outcome, c: PendingClass): { uses: boolean; text: string } {
  const pkg = c.packageNumber;
  switch (outcome) {
    case "COMPLETED":
      return { uses: true, text: `Uses 1 class from package ${pkg}.` };
    case "STUDENT_NO_SHOW":
      return c.noShowCharges
        ? { uses: true, text: `Uses 1 class: package ${pkg} charges for no-shows.` }
        : { uses: false, text: `No class used: package ${pkg} does not charge for no-shows.` };
    case "TEACHER_NO_SHOW":
      return { uses: false, text: "No class used: a trainer absence never uses the student's classes. Arrange a replacement class." };
    case "CANCELLED": {
      const hoursNotice = (new Date(c.start).getTime() - Date.now()) / 3600000;
      if (hoursNotice >= c.cancellationNoticeHours) return { uses: false, text: `No class used: cancelled with at least ${c.cancellationNoticeHours} hours' notice.` };
      return c.noShowCharges
        ? { uses: true, text: `Uses 1 class: cancelled with less than ${c.cancellationNoticeHours} hours' notice (package ${pkg} charges late cancellations).` }
        : { uses: false, text: `No class used: package ${pkg} does not charge late cancellations.` };
    }
  }
}

function RadioGroup<T extends string>({ legend, name, value, options, onChange, describe }: { legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; describe?: (v: T) => string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-ink-muted">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className={`flex min-h-[44px] cursor-pointer items-start gap-2 rounded-control border p-2.5 text-sm ${value === o.value ? "border-brand bg-brand/10" : "border-line-strong"}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 h-4 w-4 accent-teal-400" />
            <span>
              <span className="font-semibold text-ink">{o.label}</span>
              {describe && <span className="block text-ink-subtle">{describe(o.value)}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MarkAttendanceDialog({ c, onClose, onDone }: { c: PendingClass; onClose: () => void; onDone: (message: string) => void }) {
  const submitting = useRef(false);
  const [outcome, setOutcome] = useState<Outcome>("COMPLETED");
  const [attendance, setAttendance] = useState<Attendance>("PRESENT");
  const [minutes, setMinutes] = useState(String(c.durationMinutes || 60));
  const [topic, setTopic] = useState("");
  const [homework, setHomework] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const effect = creditEffect(outcome, c);
  const mins = Number(minutes) || 0;
  const earnings = outcome === "COMPLETED" && c.hourlyRate !== null ? Math.round((c.hourlyRate * mins) / 60) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const errors: Record<string, string> = {};
    if (outcome === "COMPLETED" && !topic.trim()) errors.topicCovered = "Write what was covered in the class.";
    if (!Number.isInteger(mins) || mins < 0 || mins > 300) errors.actualDurationMinutes = "Enter whole minutes between 0 and 300.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ alreadyProcessed?: boolean; message?: string; shouldConsumeCredit?: boolean }>(`/api/sessions/${c.id}/attendance`, {
        method: "POST",
        body: { sessionOutcome: outcome, studentAttendance: attendance, actualDurationMinutes: mins, topicCovered: topic.trim() || undefined, homework: homework.trim() || undefined, studentProgressNote: note.trim() || undefined },
      });
      onDone(
        data.alreadyProcessed
          ? data.message ?? "Attendance was already submitted for this class."
          : `Attendance saved for ${c.student.name} (${c.subject}). ${data.shouldConsumeCredit ? "1 class used from the package." : "No class used."}`
      );
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Could not save attendance."));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalShell labelledBy="mark-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-xl">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="mark-title" className="text-xl font-bold text-ink">Mark attendance</h2>
            <p className="text-sm text-ink-muted">
              {c.student.name} ({c.student.grade}) · {c.subject} · {c.trainer}
              <br />
              {formatInTimeZone(c.start)} IST · {c.durationMinutes} min scheduled
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <RadioGroup
          legend="What happened?"
          name="outcome"
          value={outcome}
          options={OUTCOMES}
          onChange={(v) => { setOutcome(v); setAttendance(DEFAULT_ATTENDANCE[v]); }}
          describe={(v) => (creditEffect(v, c).uses ? "Uses 1 class" : "No class used")}
        />
        <RadioGroup legend="Student attendance" name="attendance" value={attendance} options={ATTENDANCE} onChange={setAttendance} />
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label="Minutes taught" name="actualDurationMinutes" error={fieldErrors.actualDurationMinutes}>
            {(p) => <input {...p} type="number" inputMode="numeric" min={0} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.actualDurationMinutes)} tabular-nums`} />}
          </Field>
          <Field label={outcome === "COMPLETED" ? "Topic covered" : "Topic covered (optional)"} name="topicCovered" required={outcome === "COMPLETED"} error={fieldErrors.topicCovered}>
            {(p) => <input {...p} type="text" value={topic} onChange={(e) => { setTopic(e.target.value); setFieldErrors((f) => ({ ...f, topicCovered: "" })); }} placeholder="e.g. Chemical bonding: ionic bonds" className={`${controlClass} ${controlBorder(!!fieldErrors.topicCovered)}`} />}
          </Field>
        </div>
        <Field label="Homework (optional)" name="homework">
          {(p) => <input {...p} type="text" value={homework} onChange={(e) => setHomework(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}
        </Field>
        <Field label="Progress note (optional)" name="studentProgressNote">
          {(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}
        </Field>
        <Notice tone={effect.uses ? "warning" : "info"} title={effect.uses ? "This uses 1 class" : "No class is used"}>
          <p>{effect.text}</p>
          {earnings !== null && <p className="mt-1">Trainer earns ₹{earnings.toLocaleString("en-IN")} (₹{c.hourlyRate}/hour × {mins} min).</p>}
          <p className="mt-1">Submitted attendance is locked. Mistakes are fixed through a correction request.</p>
        </Notice>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} icon={CheckCircle2}>Submit attendance</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function CorrectDialog({ record, prefill, onClose, onDone }: { record: SubmittedRecord; prefill?: { outcome?: string | null; attendance?: string | null; reason?: string }; onClose: () => void; onDone: (message: string) => void }) {
  const [outcome, setOutcome] = useState<Outcome>((prefill?.outcome as Outcome) || (record.outcome as Outcome));
  const [attendance, setAttendance] = useState<Attendance>((prefill?.attendance as Attendance) || (record.attendance as Attendance));
  const [reason, setReason] = useState(prefill?.reason ? `Trainer request: ${prefill.reason}` : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ warnings?: string[] }>(`/api/attendance/${record.id}/correct`, { method: "POST", body: { newOutcome: outcome, newAttendance: attendance, reason } });
      onDone(["Attendance corrected. The change, credit and payout adjustments are recorded in the history.", ...(data.warnings ?? [])].join(" "));
    } catch (err) {
      setError(errorMessage(err, "Could not correct the attendance."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell labelledBy="correct-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-xl">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="border-b border-line pb-3">
          <h2 id="correct-title" className="text-xl font-bold text-ink">Correct attendance</h2>
          <p className="text-sm text-ink-muted">
            {record.student} · {record.subject} · {formatInTimeZone(record.start)} IST. Recorded: {OUTCOME_LABEL[record.outcome] ?? record.outcome}, {record.attendance.toLowerCase()}.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <RadioGroup legend="Correct outcome" name="correct-outcome" value={outcome} options={OUTCOMES} onChange={setOutcome} />
        <RadioGroup legend="Correct attendance" name="correct-attendance" value={attendance} options={ATTENDANCE} onChange={setAttendance} />
        <Field label="Reason (kept in the audit history)" name="reason" required>
          {(p) => <textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}
        </Field>
        <Notice tone="info">Class credits and the trainer payout are adjusted automatically. The original record and this change both stay in the history.</Notice>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Apply correction</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function RequestDialog({ record, onClose, onDone }: { record: SubmittedRecord; onClose: () => void; onDone: (message: string) => void }) {
  const [outcome, setOutcome] = useState("");
  const [attendance, setAttendance] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/attendance/${record.id}/correction-request`, {
        method: "POST",
        body: { reason, requestedOutcome: outcome || undefined, requestedAttendance: attendance || undefined },
      });
      onDone(data.message);
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setError(errorMessage(err, "Could not send the request."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell labelledBy="request-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-xl">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="border-b border-line pb-3">
          <h2 id="request-title" className="text-xl font-bold text-ink">Request a correction</h2>
          <p className="text-sm text-ink-muted">
            {record.student} · {record.subject} · {formatInTimeZone(record.start)} IST. Recorded: {OUTCOME_LABEL[record.outcome] ?? record.outcome}, {record.attendance.toLowerCase()}.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What should the outcome be?" name="requestedOutcome" error={fieldErrors.requestedOutcome}>
            {(p) => (
              <select {...p} value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${controlClass} ${controlBorder(false)}`}>
                <option value="">Keep as recorded</option>
                {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="What should attendance be?" name="requestedAttendance" error={fieldErrors.requestedAttendance}>
            {(p) => (
              <select {...p} value={attendance} onChange={(e) => setAttendance(e.target.value)} className={`${controlClass} ${controlBorder(false)}`}>
                <option value="">Keep as recorded</option>
                {ATTENDANCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="What is wrong?" name="reason" required error={fieldErrors.reason}>
          {(p) => <textarea {...p} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${controlClass} ${controlBorder(!!fieldErrors.reason)}`} />}
        </Field>
        <p className="text-sm text-ink-subtle">The coordinator reviews the request. Nothing changes until they apply it.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} icon={MessageSquareWarning}>Send request</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeclineDialog({ request, onClose, onDone }: { request: CorrectionRequestItem; onClose: () => void; onDone: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/correction-requests/${request.id}/decline`, { method: "POST", body: { note } });
      onDone(`Request from ${request.requestedBy} declined. The attendance stays as recorded.`);
    } catch (err) {
      setError(errorMessage(err, "Could not decline the request."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell labelledBy="decline-title" onClose={onClose} closeDisabled={saving} maxWidth="max-w-lg">
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 id="decline-title" className="text-xl font-bold text-ink">Decline correction request</h2>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label={`Note for ${request.requestedBy}`} name="note" required>
          {(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="danger" loading={saving}>Decline request</Button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AttendanceClient({
  pending,
  records,
  historyLimit,
  requests,
  isTrainer,
  canCorrect,
  focusSessionId,
}: {
  pending: PendingClass[];
  records: SubmittedRecord[];
  historyLimit: number;
  requests: CorrectionRequestItem[];
  isTrainer: boolean;
  canCorrect: boolean;
  focusSessionId: string | null;
}) {
  const router = useRouter();
  const openRequests = requests.filter((r) => r.status === "OPEN");
  // Links like /attendance?session=… open that class directly.
  const [tab, setTab] = useState<"pending" | "submitted" | "requests">(() =>
    focusSessionId && !pending.some((p) => p.id === focusSessionId) && records.some((r) => r.sessionId === focusSessionId) ? "submitted" : "pending"
  );
  const [marking, setMarking] = useState<PendingClass | null>(() => pending.find((p) => p.id === focusSessionId) ?? null);
  const [correcting, setCorrecting] = useState<{ record: SubmittedRecord; prefill?: { outcome?: string | null; attendance?: string | null; reason?: string } } | null>(null);
  const [requesting, setRequesting] = useState<SubmittedRecord | null>(null);
  const [declining, setDeclining] = useState<CorrectionRequestItem | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (focusSessionId && tab === "submitted") {
      document.getElementById(`record-${focusSessionId}`)?.scrollIntoView({ block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = (text: string) => {
    setMarking(null);
    setCorrecting(null);
    setRequesting(null);
    setDeclining(null);
    setBanner({ tone: "success", text });
    router.refresh();
  };

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "pending", label: `To mark (${pending.length})` },
    { id: "submitted", label: "Submitted" },
    { id: "requests", label: isTrainer ? `My correction requests (${requests.length})` : `Correction requests (${openRequests.length})` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        context="Times in IST"
        description={
          isTrainer
            ? "Mark attendance for your classes once they have started. Submitted attendance is locked; ask for a correction if something is wrong."
            : "Classes waiting for attendance, submitted records and trainers' correction requests."
        }
      />
      {banner && <Notice tone={banner.tone} onDismiss={() => setBanner(null)}>{banner.text}</Notice>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] rounded-control border px-4 text-sm font-semibold ${tab === t.id ? "border-brand bg-brand/15 text-brand-text" : "border-line-strong text-ink-muted hover:bg-raised"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <section aria-label="Classes to mark" className="rounded-card border border-line bg-surface">
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-ink-muted">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" /> No classes are waiting for attendance.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink break-words">
                      {c.student.name} <span className="font-normal text-ink-muted">· {c.subject} · {c.student.grade}</span>
                    </p>
                    <p className="text-sm text-ink-muted">
                      {formatInTimeZone(c.start)} IST{isTrainer ? "" : ` · ${c.trainer}`}
                    </p>
                  </div>
                  <Button icon={ClipboardList} onClick={() => setMarking(c)}>
                    Mark attendance<span className="sr-only"> for {c.student.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "submitted" && (
        <section aria-label="Submitted attendance" className="rounded-card border border-line bg-surface">
          <p className="border-b border-line p-4 text-sm text-ink-muted">Latest {Math.min(records.length, historyLimit)} submitted classes, newest first.</p>
          {records.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No attendance submitted yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {records.map((r) => (
                <li key={r.id} id={`record-${r.sessionId}`} className={`flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between ${r.sessionId === focusSessionId ? "bg-brand/5" : ""}`}>
                  <div className="min-w-0 space-y-0.5 text-sm">
                    <p className="text-base font-semibold text-ink break-words">
                      {r.student} <span className="font-normal text-ink-muted">· {r.subject}</span>
                    </p>
                    <p className="text-ink-muted">{formatInTimeZone(r.start)} IST{isTrainer ? "" : ` · ${r.trainer}`}</p>
                    <p className="text-ink">
                      <strong>{OUTCOME_LABEL[r.outcome] ?? r.outcome}</strong> · student {r.attendance.toLowerCase()} · {r.minutes} min
                      {r.reversed && <span className="ml-2 rounded-full border border-amber-300/50 px-2 text-warning">Corrected</span>}
                    </p>
                    <p className="text-ink-muted break-words">Topic: {r.topic}{r.homework ? ` · Homework: ${r.homework}` : ""}</p>
                    <p className="text-ink-subtle">Submitted by {r.markedBy}, {formatInTimeZone(r.markedAt)} IST</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canCorrect && (
                      <Button variant="secondary" size="sm" onClick={() => setCorrecting({ record: r })}>
                        Correct<span className="sr-only"> attendance for {r.student}</span>
                      </Button>
                    )}
                    {isTrainer &&
                      (r.openRequest ? (
                        <span className="inline-flex min-h-[44px] items-center rounded-control border border-sky-300/40 px-3 text-sm text-info">Correction requested</span>
                      ) : (
                        <Button variant="outline" size="sm" icon={MessageSquareWarning} onClick={() => setRequesting(r)}>
                          Request correction<span className="sr-only"> for {r.student}</span>
                        </Button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "requests" && (
        <section aria-label="Correction requests" className="rounded-card border border-line bg-surface">
          {requests.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">{isTrainer ? "You have not asked for any corrections." : "No open correction requests."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((q) => {
                const record = records.find((r) => r.id === q.recordId);
                return (
                  <li key={q.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-0.5 text-sm">
                      <p className="text-base font-semibold text-ink break-words">
                        {q.student} <span className="font-normal text-ink-muted">· {q.subject} · {formatInTimeZone(q.start)} IST</span>
                      </p>
                      <p className="text-ink-muted">
                        Recorded: {OUTCOME_LABEL[q.currentOutcome] ?? q.currentOutcome}, {q.currentAttendance.toLowerCase()}
                        {q.requestedOutcome || q.requestedAttendance
                          ? ` → asked for ${[q.requestedOutcome ? OUTCOME_LABEL[q.requestedOutcome] : null, q.requestedAttendance?.toLowerCase()].filter(Boolean).join(", ")}`
                          : ""}
                      </p>
                      <p className="text-ink break-words">“{q.reason}” — {q.requestedBy}, {formatInTimeZone(q.createdAt)} IST</p>
                      {q.status !== "OPEN" && (
                        <p className={q.status === "DECLINED" ? "text-warning" : "text-success"}>
                          {q.status === "DECLINED" ? "Declined" : "Corrected"} by {q.resolvedBy}{q.resolutionNote ? `: ${q.resolutionNote}` : ""}
                        </p>
                      )}
                      {q.status === "OPEN" && isTrainer && <p className="text-info">Waiting for staff.</p>}
                    </div>
                    {canCorrect && q.status === "OPEN" && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {record && (
                          <Button size="sm" onClick={() => setCorrecting({ record, prefill: { outcome: q.requestedOutcome, attendance: q.requestedAttendance, reason: q.reason } })}>
                            Correct now
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDeclining(q)}>Decline</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {marking && <MarkAttendanceDialog c={marking} onClose={() => setMarking(null)} onDone={done} />}
      {correcting && <CorrectDialog record={correcting.record} prefill={correcting.prefill} onClose={() => setCorrecting(null)} onDone={done} />}
      {requesting && <RequestDialog record={requesting} onClose={() => setRequesting(null)} onDone={done} />}
      {declining && <DeclineDialog request={declining} onClose={() => setDeclining(null)} onDone={done} />}
    </div>
  );
}
