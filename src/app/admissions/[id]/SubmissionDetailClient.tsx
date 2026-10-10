"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Link2, MessageSquarePlus, Save, Trash2, Unlink, UserPlus } from "lucide-react";
import { ALL_GRADES } from "@/lib/grades";
import { MANUAL_STATUSES, dayList, statusLabel, weekdayName } from "@/lib/intake";
import { admissionPrefill } from "@/lib/intake-prefill";
import { formatInTimeZone } from "@/lib/timezones";
import { apiRequest, errorMessage } from "@/lib/client-api";
import type { SubmissionDetail } from "@/lib/services/parent-submissions";
import type { AdmissionDraftItem, IntakeContext } from "@/lib/services/admission-drafts";
import { StudentFormModal, SubjectOption, TeacherOption } from "@/components/students/StudentFormModal";
import { displayTime } from "@/components/students/admission/WeeklyScheduleStep";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { StatusChip } from "../AdmissionsClient";

const gradeLabel = (value: string) => ALL_GRADES.find((g) => g.value === value)?.label ?? value;

export function SubmissionDetailClient({
  initialDetail,
  subjects,
  teachers,
  staff,
  draft,
  canDelete = false,
}: {
  initialDetail: SubmissionDetail;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  staff: { id: string; name: string }[];
  draft: AdmissionDraftItem | null;
  /** Owner only: delete at the parent's request. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState(initialDetail.status);
  const [assignee, setAssignee] = useState(initialDetail.assignedToUserId ?? "");
  const [followUp, setFollowUp] = useState(initialDetail.followUpOn ?? "");
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fresh server data after router.refresh() (e.g. a draft was just saved) replaces the local copy
  // without closing an open admission form.
  const [seen, setSeen] = useState(initialDetail);
  if (initialDetail !== seen) {
    setSeen(initialDetail);
    setDetail(initialDetail);
    setStatus(initialDetail.status);
    setAssignee(initialDetail.assignedToUserId ?? "");
    setFollowUp(initialDetail.followUpOn ?? "");
  }

  const s = detail.submitted;
  const converted = detail.status === "CONVERTED";
  const intake: IntakeContext | null = s
    ? {
        id: detail.id,
        reference: detail.reference,
        preferredDays: s.preferredDays,
        preferences: s.preferences.map((p) => ({ subjectId: p.subjectId, subjectName: p.subjectName, weekday: p.weekday, start: p.start, end: p.end })),
      }
    : null;
  const prefill = useMemo(() => (s ? admissionPrefill(s, detail.reference, formatInTimeZone(detail.createdAt)) : null), [s, detail.reference, detail.createdAt]);

  const patch = async (body: Record<string, unknown>, done: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await apiRequest<{ submission: SubmissionDetail }>(`/api/parent-submissions/${detail.id}`, { method: "PATCH", body });
      setDetail(res.submission);
      setStatus(res.submission.status);
      setAssignee(res.submission.assignedToUserId ?? "");
      setFollowUp(res.submission.followUpOn ?? "");
      setNotice({ tone: "success", text: done });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not save the changes.") });
    } finally {
      setSaving(false);
    }
  };

  const saveManagement = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { assignedToUserId: assignee || null, followUpOn: followUp || null };
    if (!converted) body.status = status;
    void patch(body, "Changes saved.");
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) {
      setNoteError("Write the note first.");
      return;
    }
    setAddingNote(true);
    setNoteError("");
    try {
      const res = await apiRequest<{ submission: SubmissionDetail }>(`/api/parent-submissions/${detail.id}/notes`, { method: "POST", body: { body: noteText } });
      setDetail(res.submission);
      setNoteText("");
    } catch (error) {
      setNoteError(errorMessage(error, "Could not add the note."));
    } finally {
      setAddingNote(false);
    }
  };

  const removeSubmission = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/parent-submissions/${detail.id}`, { method: "DELETE" });
      router.push("/admissions");
      router.refresh();
    } catch (error) {
      setDeleteError(errorMessage(error, "Could not delete the submission."));
      setDeleting(false);
    }
  };

  const linkCandidates = [
    ...detail.matches.sameNameStudents.map((st) => ({ id: st.id, label: `${st.name} (${st.studentCode})`, why: st.samePhone ? "same name and parent number" : "same name" })),
    ...detail.matches.guardians.flatMap((g) => g.students.map((st) => ({ id: st.id, label: `${st.name} (${st.studentCode})`, why: `child of ${g.name}, same parent number` }))),
  ].filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);

  return (
    <div className="space-y-6">
      <Link href="/admissions" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admissions
      </Link>
      <PageHeader
        context={<span className="font-mono">{detail.reference}</span>}
        title={detail.submitted?.studentName ?? "Parent submission"}
        description={`Submitted ${formatInTimeZone(detail.createdAt)} IST through the parent form.`}
        actions={
          !converted && s ? (
            <Button type="button" icon={UserPlus} onClick={() => setFormOpen(true)}>
              {detail.draft ? "Continue admission" : "Review & Start Admission"}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={detail.status} label={detail.statusLabel} />
        {detail.draft && !converted && (
          <span className="text-sm text-ink-muted">Admission draft saved by {detail.draft.updatedByName} at {formatInTimeZone(detail.draft.updatedAt)} IST</span>
        )}
      </div>

      {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}

      {converted && detail.convertedStudent && (
        <Notice tone="success" title="Converted into an admission">
          {detail.convertedByName ? `${detail.convertedByName} confirmed the admission` : "The admission was confirmed"}
          {detail.convertedAt ? ` on ${formatInTimeZone(detail.convertedAt)} IST` : ""}.{" "}
          <Link href={`/students/${detail.convertedStudent.id}`} className="font-semibold underline">
            Open {detail.convertedStudent.name} ({detail.convertedStudent.studentCode})
          </Link>
        </Notice>
      )}
      {!s && <Notice tone="error">The submitted details could not be read.</Notice>}

      {(detail.matches.guardians.length > 0 || detail.matches.sameNameStudents.length > 0 || detail.matches.otherSubmissions.length > 0) && (
        <section aria-labelledby="matches-heading" className="space-y-3 rounded-card border border-warning/50 bg-surface p-4 sm:p-5">
          <h2 id="matches-heading" className="text-lg font-semibold text-ink">Check before admitting</h2>
          <p className="text-sm text-ink-muted">Possible duplicates or siblings. Nothing has been merged: decide with the parent.</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            {detail.matches.guardians.map((g) => (
              <li key={g.id}>
                Same WhatsApp number as existing parent <strong>{g.name}</strong>
                {g.students.length ? <> (children: {g.students.map((st, i) => <span key={st.id}>{i ? ", " : ""}<Link href={`/students/${st.id}`} className="underline">{st.name}</Link></span>)})</> : null}.
                {" "}If this is a brother or sister, use “Link as sibling” in the admission form.
              </li>
            ))}
            {detail.matches.sameNameStudents.map((st) => (
              <li key={st.id}>
                A student with the same name already exists: <Link href={`/students/${st.id}`} className="underline">{st.name} ({st.studentCode})</Link>, parent {st.guardianName}
                {st.samePhone ? " — same parent number, so this may be a duplicate." : "."}
              </li>
            ))}
            {detail.matches.otherSubmissions.map((o) => (
              <li key={o.id}>
                Another submission from this number: <Link href={`/admissions/${o.id}`} className="font-mono underline">{o.reference}</Link> for {o.studentName} ({o.statusLabel})
                {o.sameName ? " — same student name." : "."}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {s && (
            <section aria-labelledby="submitted-heading" className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
              <h2 id="submitted-heading" className="text-lg font-semibold text-ink">What the parent submitted</h2>
              <p className="text-sm text-ink-muted">Kept exactly as sent. Corrections are made in the admission form, not here.</p>
              <Details title="Student" rows={[
                ["Full name", s.studentName],
                ["Class / grade", gradeLabel(s.grade)],
                ["Board / curriculum", s.board],
                ["School", s.schoolName],
                ["Medium", s.medium],
                ["Subjects", s.subjects.map((x) => x.name).join(", ")],
              ]} />
              <Details title="Parent / guardian" rows={[
                ["Full name", s.guardianName],
                ["Relationship", s.relationship],
                ["WhatsApp", s.whatsappNumber],
                ["Alternative number", s.altPhone],
                ["Email", s.email],
                ["Country", s.country],
                ["City", s.city],
              ]} />
              <Details title="Learning needs" rows={[
                ["Help needed with", s.helpAreas],
                ["Teaching language", s.teachingLanguage],
                ["Preferred start date", s.startDate],
                ["Notes", s.notes],
              ]} />
              <div>
                <h3 className="text-base font-semibold text-ink">Preferred class days (not confirmed)</h3>
                {s.preferredDays.length === 0 && s.preferences.length === 0 ? (
                  <p className="text-sm text-ink-muted">None given.</p>
                ) : (
                  <>
                    {s.preferredDays.length > 0 && <p className="mt-1 text-sm text-ink">{dayList(s.preferredDays)}</p>}
                    {s.preferences.length > 0 && (
                      // The earlier form asked for a day and time (IST) per subject.
                      <ul className="mt-1 space-y-1 text-sm text-ink">
                        {s.preferences.map((p, i) => (
                          <li key={i}>{p.subjectName}: {weekdayName(p.weekday)}, {displayTime(p.start)} to {displayTime(p.end)} IST</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <p className="mt-1 text-xs text-ink-subtle">Preferences only: they create no classes, trainer bookings or package reservations.</p>
              </div>
              <p className="text-sm text-ink-muted">
                <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" aria-hidden="true" />
                The parent agreed that Xello may use these details to contact them and process the application.
              </p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <form onSubmit={saveManagement} className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5" aria-labelledby="manage-heading">
            <h2 id="manage-heading" className="text-lg font-semibold text-ink">Follow-up</h2>
            <Field label="Status" name="status" hint={converted ? "Set automatically when the admission was confirmed." : "Converted is set automatically when you confirm the admission."}>
              {(p) => (
                <select {...p} value={status} disabled={converted || saving} onChange={(e) => setStatus(e.target.value)} className={`${controlClass} ${controlBorder(false)}`}>
                  {(converted ? ["CONVERTED"] : MANUAL_STATUSES).map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}
                </select>
              )}
            </Field>
            <Field label="Assigned coordinator" name="assignedToUserId">
              {(p) => (
                <select {...p} value={assignee} disabled={saving} onChange={(e) => setAssignee(e.target.value)} className={`${controlClass} ${controlBorder(false)}`}>
                  <option value="">Not assigned</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Follow-up date (IST)" name="followUpOn">
              {(p) => <input {...p} type="date" value={followUp} disabled={saving} onChange={(e) => setFollowUp(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}
            </Field>
            <Button type="submit" icon={Save} loading={saving}>Save</Button>
          </form>

          <section aria-labelledby="link-student-heading" className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5">
            <h2 id="link-student-heading" className="text-lg font-semibold text-ink">Existing student</h2>
            {detail.linkedStudent ? (
              <>
                <p className="text-sm text-ink">
                  Linked to <Link href={`/students/${detail.linkedStudent.id}`} className="font-semibold underline">{detail.linkedStudent.name} ({detail.linkedStudent.studentCode})</Link>.
                </p>
                <Button type="button" variant="outline" size="sm" icon={Unlink} disabled={saving} onClick={() => patch({ linkedStudentId: null }, "Link to the existing student removed.")}>
                  Remove link
                </Button>
              </>
            ) : linkCandidates.length ? (
              <>
                <p className="text-sm text-ink-muted">If this enquiry is about a student already in the app (for example extra subjects), link it instead of admitting again.</p>
                <ul className="space-y-2">
                  {linkCandidates.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-ink">{c.label} <span className="text-ink-subtle">({c.why})</span></span>
                      <Button type="button" variant="secondary" size="sm" icon={Link2} disabled={saving} onClick={() => patch({ linkedStudentId: c.id }, `Linked to ${c.label}.`)}>
                        Link
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-ink-muted">No existing student matches this name or parent number.</p>
            )}
          </section>

          {canDelete && !converted && (
            <section aria-labelledby="delete-heading" className="space-y-2 rounded-card border border-line bg-surface p-4 sm:p-5">
              <h2 id="delete-heading" className="text-lg font-semibold text-ink">Delete at the parent&apos;s request</h2>
              <p className="text-sm text-ink-muted">Removes this submission, its notes and any unfinished admission draft for it. This cannot be undone.</p>
              <Button type="button" variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete this submission
              </Button>
            </section>
          )}

          <section aria-labelledby="notes-heading" className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5">
            <h2 id="notes-heading" className="text-lg font-semibold text-ink">Notes</h2>
            <form onSubmit={addNote} className="space-y-2">
              <Field label="New note (staff only)" name="body" error={noteError}>
                {(p) => <textarea {...p} rows={3} maxLength={2000} value={noteText} onChange={(e) => setNoteText(e.target.value)} className={`${controlClass} ${controlBorder(Boolean(noteError))}`} />}
              </Field>
              <Button type="submit" variant="secondary" icon={MessageSquarePlus} loading={addingNote}>Add note</Button>
            </form>
            {detail.notes.length === 0 ? (
              <p className="text-sm text-ink-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {detail.notes.map((n) => (
                  <li key={n.id} className="rounded-control border border-line p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-ink">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-subtle">{n.authorName} · {formatInTimeZone(n.createdAt)} IST</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {confirmDelete && (
        <DeleteConfirmModal
          title="Delete this parent submission?"
          message="Only do this when the parent asked for their details to be deleted. The submission, its notes and any unfinished admission draft are removed permanently; the audit log keeps only the reference."
          itemName={detail.submitted?.studentName ?? detail.reference}
          itemDetails={detail.reference}
          confirmLabel="Delete submission"
          loading={deleting}
          errorMessage={deleteError}
          onConfirm={removeSubmission}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        />
      )}

      {formOpen && s && (
        <StudentFormModal
          mode="create"
          draft={draft}
          prefill={draft ? null : prefill}
          intake={intake}
          subjects={subjects}
          teachers={teachers}
          onClose={() => {
            setFormOpen(false);
            router.refresh();
          }}
          onSuccess={(_student, message) => {
            setFormOpen(false);
            setNotice({ tone: "success", text: message });
            router.refresh();
          }}
          onDraftsChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Details({ title, rows }: { title: string; rows: [string, string | null | undefined][] }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <dl className="mt-1 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className={`whitespace-pre-wrap break-words text-sm ${value ? "text-ink" : "text-ink-subtle"}`}>{value || "Not given"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
