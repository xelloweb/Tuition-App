"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, GraduationCap, Pencil, Plus, Search, Send, Trash2, UserPlus } from "lucide-react";
import { ALL_GRADES } from "@/lib/grades";
import { BOARD_OPTIONS, MEDIUM_OPTIONS } from "@/lib/constants";
import {
  COUNTRY_OPTIONS,
  INTAKE_LIMITS,
  IntakeInput,
  RELATIONSHIPS,
  TEACHING_LANGUAGES,
  WEEKDAYS,
  emptyIntake,
  validateIntake,
  weekdayName,
} from "@/lib/intake";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

interface Props {
  subjects: { id: string; name: string }[];
  formToken: string;
  privacyUrl: string | null;
  preview: boolean;
  todayIst: string;
}

type Phase = "form" | "review" | "done";
type PrefRow = { key: string; subjectId: string; weekday: string; start: string; end: string };

const IST_NOTICE =
  "All timings must be entered in Indian Standard Time (IST). These are preferences only. Xello will confirm the final timetable after checking trainer availability.";
const SUCCESS =
  "Thank you! Your details have been submitted. The Xello Tuition team will contact you to confirm the next steps.";

const GRADE_GROUPS = ["Kindergarten", "Primary School", "Middle School", "High School", "Higher Secondary (+1 & +2)"] as const;

function randomKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
let prefCounter = 0;
const prefKey = () => `pref-${(prefCounter++).toString(36)}`;

/** "17:30" → "5:30 PM" (the value itself is IST wall-clock time). */
function time12(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Error keys in the order the form shows them, so the summary reads top to bottom. */
const FIELD_ORDER = [
  "studentName", "grade", "board", "schoolName", "medium", "subjectIds",
  "guardianName", "relationship", "country", "whatsappNumber", "altPhone", "email", "city",
  "helpAreas", "teachingLanguage", "startDate", "notes", "preferences", "consent",
];
const FIELD_LABELS: Record<string, string> = {
  studentName: "Student's full name",
  grade: "Class / grade",
  board: "Board / curriculum",
  schoolName: "School name",
  medium: "Medium of instruction",
  subjectIds: "Subjects",
  guardianName: "Parent / guardian's full name",
  relationship: "Relationship to the student",
  country: "Country of residence",
  whatsappNumber: "WhatsApp number",
  altPhone: "Alternative contact number",
  email: "Email",
  city: "City",
  helpAreas: "Areas where help is needed",
  teachingLanguage: "Preferred teaching language",
  startDate: "Preferred start date",
  notes: "Additional notes",
  preferences: "Preferred class timings",
  consent: "Agreement",
};
const labelFor = (key: string) => {
  const pref = /^preferences\.(\d+)\./.exec(key);
  return pref ? `Preferred time ${Number(pref[1]) + 1}` : FIELD_LABELS[key] ?? key;
};
const orderOf = (key: string) => {
  const base = key.split(".")[0];
  const i = FIELD_ORDER.indexOf(base);
  return i === -1 ? FIELD_ORDER.length : i;
};

export function IntakeForm({ subjects, formToken, privacyUrl, preview, todayIst }: Props) {
  const [values, setValues] = useState<IntakeInput>(emptyIntake);
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [reference, setReference] = useState("");
  const [token, setToken] = useState(formToken);
  const [submissionKey, setSubmissionKey] = useState(randomKey);
  const [subjectQuery, setSubjectQuery] = useState("");
  const submittingRef = useRef(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";
  const chosenSubjects = subjects.filter((s) => values.subjectIds.includes(s.id));
  const visibleSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    return q ? subjects.filter((s) => s.name.toLowerCase().includes(q) || values.subjectIds.includes(s.id)) : subjects;
  }, [subjects, subjectQuery, values.subjectIds]);

  const clearError = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  const set = <K extends keyof IntakeInput>(key: K, value: IntakeInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    clearError(key as string);
  };

  const changeCountry = (country: string) => {
    const dial = COUNTRY_OPTIONS.find((c) => c.value === country)?.dialCode;
    setValues((v) => {
      const digits = v.whatsappNumber.replace(/\D/g, "");
      const onlyCode = !digits || COUNTRY_OPTIONS.some((c) => c.dialCode.slice(1) === digits);
      return { ...v, country, whatsappNumber: dial && onlyCode ? `${dial} ` : v.whatsappNumber };
    });
    clearError("country");
  };

  const toggleSubject = (id: string, checked: boolean) => {
    setValues((v) => ({ ...v, subjectIds: checked ? [...v.subjectIds, id] : v.subjectIds.filter((s) => s !== id) }));
    if (!checked) setPrefs((rows) => rows.filter((r) => r.subjectId !== id));
    clearError("subjectIds");
  };

  const addPref = () => {
    const first = values.subjectIds[0] ?? "";
    setPrefs((rows) => [...rows, { key: prefKey(), subjectId: first, weekday: "1", start: "17:00", end: "18:00" }]);
    clearError("preferences");
  };
  const updatePref = (key: string, patch: Partial<PrefRow>) => {
    setPrefs((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const i = prefs.findIndex((r) => r.key === key);
    if (i >= 0) clearError(`preferences.${i}.subjectId`, `preferences.${i}.weekday`, `preferences.${i}.start`, `preferences.${i}.end`);
  };
  const removePref = (key: string) => {
    setPrefs((rows) => rows.filter((r) => r.key !== key));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("preferences."))));
  };

  const payload = () => ({
    ...values,
    preferences: prefs.map((p) => ({ subjectId: p.subjectId, weekday: Number(p.weekday), start: p.start, end: p.end })),
  });

  const showErrors = (found: Record<string, string>, message = "Please check the answers marked below.") => {
    setErrors(found);
    setServerError(message);
    setPhase("form");
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const review = () => {
    const { errors: found } = validateIntake(payload(), { subjectIds: null, todayIst });
    if (Object.keys(found).length) return showErrors(found);
    setErrors({});
    setServerError("");
    setPhase("review");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      reviewHeadingRef.current?.focus();
    });
  };

  const focusField = (key: string) => {
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError("");
    const send = (formToken: string) =>
      fetch("/api/public/admission-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), formToken, submissionKey, website: honeypotRef.current?.value ?? "" }),
      });
    try {
      let res = await send(token);
      let json = await res.json().catch(() => null);
      if (res.status === 409 && json?.details?.reason === "FORM_EXPIRED") {
        // The page was open a long time: get a fresh token and send the same answers again.
        const fresh = await fetch("/api/public/admission-enquiries/token", { cache: "no-store" }).then((r) => r.json());
        setToken(fresh.formToken);
        await new Promise((resolve) => setTimeout(resolve, 3200));
        res = await send(fresh.formToken);
        json = await res.json().catch(() => null);
      }
      if (res.ok && typeof json?.reference === "string") {
        setReference(json.reference);
        setPhase("done");
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0 });
          doneHeadingRef.current?.focus();
        });
        return;
      }
      if (json?.fieldErrors && Object.keys(json.fieldErrors).length) {
        showErrors(json.fieldErrors, json.error ?? "Please check the answers marked below.");
        return;
      }
      setServerError(
        typeof json?.error === "string"
          ? `${json.error} Your answers are still here.`
          : "We could not send your details. Your answers are still here; please try again."
      );
    } catch {
      setServerError("We could not reach Xello Tuition. Your answers are still here. Check your internet connection and press “Submit Student Details” again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /** Keeps the parent's details for a brother or sister; the student section starts empty. */
  const anotherChild = () => {
    setValues((v) => ({ ...emptyIntake(), guardianName: v.guardianName, relationship: v.relationship, whatsappNumber: v.whatsappNumber, altPhone: v.altPhone, email: v.email, country: v.country, city: v.city }));
    setPrefs([]);
    setErrors({});
    setServerError("");
    setReference("");
    setSubmissionKey(randomKey());
    setPhase("form");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      focusField("studentName");
    });
  };

  const err = (key: string) => errors[key];
  const ctl = (key: string) => `${controlClass} ${controlBorder(Boolean(errors[key]))} min-h-[48px] text-base`;
  const errorKeys = Object.keys(errors).sort((a, b) => orderOf(a) - orderOf(b));

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
        <header className="mb-6">
          <p className="flex items-center gap-2 text-base font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-brand-ink" aria-hidden="true">
              <GraduationCap className="h-5 w-5" />
            </span>
            Xello Tuition
          </p>
          <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Student admission form</h1>
          {phase !== "done" && (
            <>
              <p className="mt-2 text-base text-ink-muted">
                Tell us about your child and the help they need. It takes about 5 minutes. The Xello Tuition team will contact you on
                WhatsApp to confirm the next steps.
              </p>
              <p className="mt-3 text-sm font-semibold text-ink-muted" aria-live="polite">
                {phase === "form" ? "Step 1 of 2: Your details" : "Step 2 of 2: Check and submit"}
              </p>
              <div className="mt-2 h-2 rounded-full bg-raised" aria-hidden="true">
                <div className={`h-2 rounded-full bg-brand ${phase === "form" ? "w-1/2" : "w-full"}`} />
              </div>
            </>
          )}
        </header>

        {preview && phase !== "done" && (
          <Notice tone="warning" title="Preview only" className="mb-5">
            The privacy notice link is not set yet, so this form must not be shared with parents.
          </Notice>
        )}

        {phase === "done" && (
          <section aria-labelledby="done-heading" className="rounded-card border border-success/40 bg-surface p-5 sm:p-6">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
            <h2 id="done-heading" ref={doneHeadingRef} tabIndex={-1} className="mt-3 text-xl font-bold focus:outline-none">
              Details submitted
            </h2>
            <p className="mt-2 text-base text-ink">{SUCCESS}</p>
            <p className="mt-4 text-base text-ink-muted">
              Your reference: <strong className="font-mono text-lg text-ink">{reference}</strong>
            </p>
            <p className="mt-1 text-sm text-ink-muted">Keep it in case you contact us about this form.</p>
            <div className="mt-6">
              <Button type="button" variant="outline" size="lg" icon={UserPlus} onClick={anotherChild}>
                Add details for another child
              </Button>
            </div>
          </section>
        )}

        {phase !== "done" && (serverError || errorKeys.length > 0) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-5 rounded-card border border-rose-400/60 bg-rose-500/10 p-4 focus:outline-none">
            <p className="font-semibold text-ink">{serverError || "Please check the answers marked below."}</p>
            {errorKeys.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {errorKeys.map((key) => (
                  <li key={key}>
                    <button type="button" className="text-left text-danger underline" onClick={() => focusField(key)}>
                      {labelFor(key)}: {errors[key]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {phase === "review" && (
          <section aria-labelledby="review-heading" className="space-y-5">
            <h2 id="review-heading" ref={reviewHeadingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none">
              Check your details
            </h2>
            <p className="text-base text-ink-muted">Nothing has been sent yet. Use “Edit” to change anything.</p>
            <ReviewBlock title="Student" onEdit={() => { setPhase("form"); requestAnimationFrame(() => focusField("studentName")); }}>
              <dl className="space-y-2">
                <Row label="Full name" value={values.studentName} />
                <Row label="Class / grade" value={ALL_GRADES.find((g) => g.value === values.grade)?.label ?? values.grade} />
                <Row label="Board / curriculum" value={values.board} />
                <Row label="School" value={values.schoolName} />
                <Row label="Medium" value={values.medium} />
                <Row label="Subjects" value={chosenSubjects.map((s) => s.name).join(", ")} />
              </dl>
            </ReviewBlock>
            <ReviewBlock title="Parent / guardian" onEdit={() => { setPhase("form"); requestAnimationFrame(() => focusField("guardianName")); }}>
              <dl className="space-y-2">
                <Row label="Full name" value={values.guardianName} />
                <Row label="Relationship" value={values.relationship} />
                <Row label="WhatsApp" value={values.whatsappNumber} mono />
                <Row label="Alternative number" value={values.altPhone} mono />
                <Row label="Email" value={values.email} />
                <Row label="Country" value={COUNTRY_OPTIONS.find((c) => c.value === values.country)?.label ?? values.country} />
                <Row label="City" value={values.city} />
              </dl>
            </ReviewBlock>
            <ReviewBlock title="Learning needs" onEdit={() => { setPhase("form"); requestAnimationFrame(() => focusField("helpAreas")); }}>
              <dl className="space-y-2">
                <Row label="Help needed with" value={values.helpAreas} />
                <Row label="Teaching language" value={values.teachingLanguage} />
                <Row label="Preferred start" value={values.startDate ? formatDate(values.startDate) : ""} />
                <Row label="Notes" value={values.notes} />
              </dl>
            </ReviewBlock>
            <ReviewBlock title="Preferred class timings (IST)" onEdit={() => { setPhase("form"); requestAnimationFrame(() => focusField("preferences")); }}>
              {prefs.length === 0 ? (
                <p className="text-base text-ink-muted">No preferred times added.</p>
              ) : (
                <ul className="space-y-1 text-base">
                  {prefs.map((p) => (
                    <li key={p.key}>
                      {subjectName(p.subjectId)}: {weekdayName(Number(p.weekday))}, {time12(p.start)} to {time12(p.end)} IST
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm text-ink-muted">These are preferences only. Xello will confirm the final timetable after checking trainer availability.</p>
            </ReviewBlock>
            <p className="text-base text-ink-muted">
              You agreed that Xello Tuition may use these details to contact you and to process this tuition application.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" size="lg" icon={Pencil} onClick={() => setPhase("form")} disabled={submitting}>
                Edit details
              </Button>
              <Button type="button" size="lg" icon={Send} onClick={submit} loading={submitting} aria-describedby="submit-status">
                {submitting ? "Submitting…" : "Submit Student Details"}
              </Button>
            </div>
            <p id="submit-status" role="status" className="text-sm text-ink-muted">
              {submitting ? "Sending your details to Xello Tuition…" : ""}
            </p>
          </section>
        )}

        {phase === "form" && (
          <form
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
            className="space-y-8"
          >
            <p className="text-sm text-ink-muted">
              Questions marked <span className="text-danger">*</span> are required. Everything else is optional.
            </p>

            {/* People never see this field; automated scripts often fill it in. */}
            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="website-field">Leave this field empty</label>
              <input id="website-field" ref={honeypotRef} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>

            <fieldset className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
              <legend className="px-1"><h2 className="text-lg font-bold">Student details</h2></legend>
              <Field label="Student's full name" name="studentName" required error={err("studentName")}>
                {(p) => <input {...p} type="text" autoComplete="off" maxLength={INTAKE_LIMITS.shortText} value={values.studentName} onChange={(e) => set("studentName", e.target.value)} className={ctl("studentName")} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Class / grade" name="grade" required error={err("grade")}>
                  {(p) => (
                    <select {...p} value={values.grade} onChange={(e) => set("grade", e.target.value)} className={ctl("grade")}>
                      <option value="">Choose…</option>
                      {GRADE_GROUPS.map((group) => (
                        <optgroup key={group} label={group}>
                          {ALL_GRADES.filter((g) => g.category === group).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Board / curriculum" name="board" required error={err("board")}>
                  {(p) => (
                    <select {...p} value={values.board} onChange={(e) => set("board", e.target.value)} className={ctl("board")}>
                      <option value="">Choose…</option>
                      {BOARD_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="School name (optional)" name="schoolName" error={err("schoolName")}>
                  {(p) => <input {...p} type="text" autoComplete="off" maxLength={150} value={values.schoolName} onChange={(e) => set("schoolName", e.target.value)} className={ctl("schoolName")} />}
                </Field>
                <Field label="Medium of instruction (optional)" name="medium" error={err("medium")}>
                  {(p) => (
                    <select {...p} value={values.medium} onChange={(e) => set("medium", e.target.value)} className={ctl("medium")}>
                      <option value="">Choose…</option>
                      {MEDIUM_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                </Field>
              </div>

              <fieldset data-field="subjectIds" tabIndex={-1} aria-describedby={err("subjectIds") ? "subjects-error" : "subjects-hint"} className="focus:outline-none">
                <legend className="mb-1 text-sm font-semibold text-ink-muted">
                  Subjects that need tuition <span className="text-danger">*<span className="sr-only"> (required)</span></span>
                </legend>
                <p id="subjects-hint" className="mb-2 text-sm text-ink-muted">
                  Choose all that apply ({values.subjectIds.length} chosen).
                </p>
                {subjects.length > 8 && (
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                    <label htmlFor="subject-search" className="sr-only">Find a subject</label>
                    <input id="subject-search" type="search" placeholder="Find a subject" value={subjectQuery} onChange={(e) => setSubjectQuery(e.target.value)} className={`${controlClass} ${controlBorder(false)} min-h-[48px] pl-9 text-base`} />
                  </div>
                )}
                {subjects.length === 0 ? (
                  <p className="text-base text-ink-muted">Subjects are not available right now. Please contact Xello Tuition.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {visibleSubjects.map((s) => {
                      const checked = values.subjectIds.includes(s.id);
                      return (
                        <li key={s.id}>
                          <label className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-base ${checked ? "border-brand bg-brand/10" : "border-line-strong bg-raised"}`}>
                            <input type="checkbox" checked={checked} onChange={(e) => toggleSubject(s.id, e.target.checked)} className="h-5 w-5 shrink-0 accent-teal-400" />
                            {s.name}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {err("subjectIds") && <p id="subjects-error" className="mt-2 text-sm font-medium text-danger">{err("subjectIds")}</p>}
              </fieldset>
            </fieldset>

            <fieldset className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
              <legend className="px-1"><h2 className="text-lg font-bold">Parent or guardian</h2></legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" name="guardianName" required error={err("guardianName")}>
                  {(p) => <input {...p} type="text" autoComplete="name" maxLength={INTAKE_LIMITS.shortText} value={values.guardianName} onChange={(e) => set("guardianName", e.target.value)} className={ctl("guardianName")} />}
                </Field>
                <Field label="Relationship to the student" name="relationship" required error={err("relationship")}>
                  {(p) => (
                    <select {...p} value={values.relationship} onChange={(e) => set("relationship", e.target.value)} className={ctl("relationship")}>
                      <option value="">Choose…</option>
                      {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Country where you live" name="country" required error={err("country")} hint="Class times are always in Indian Standard Time (IST), wherever you live.">
                  {(p) => (
                    <select {...p} value={values.country} onChange={(e) => changeCountry(e.target.value)} className={ctl("country")}>
                      <option value="">Choose…</option>
                      {COUNTRY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label} ({c.dialCode})</option>)}
                    </select>
                  )}
                </Field>
                <Field label="WhatsApp number with country code" name="whatsappNumber" required error={err("whatsappNumber")} hint="For example +971 50 123 4567 or +91 98470 12345">
                  {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={values.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} className={`${ctl("whatsappNumber")} font-mono`} />}
                </Field>
                <Field label="Alternative contact number (optional)" name="altPhone" error={err("altPhone")}>
                  {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={values.altPhone} onChange={(e) => set("altPhone", e.target.value)} className={`${ctl("altPhone")} font-mono`} />}
                </Field>
                <Field label="Email (optional)" name="email" error={err("email")}>
                  {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" maxLength={254} value={values.email} onChange={(e) => set("email", e.target.value)} className={ctl("email")} />}
                </Field>
                <Field label="City (optional)" name="city" error={err("city")}>
                  {(p) => <input {...p} type="text" autoComplete="address-level2" maxLength={80} value={values.city} onChange={(e) => set("city", e.target.value)} className={ctl("city")} />}
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5">
              <legend className="px-1"><h2 className="text-lg font-bold">Learning needs</h2></legend>
              <Field label="Areas where your child needs help (optional)" name="helpAreas" error={err("helpAreas")} hint="For example: algebra, exam preparation, reading confidence">
                {(p) => <textarea {...p} rows={3} maxLength={INTAKE_LIMITS.textArea} value={values.helpAreas} onChange={(e) => set("helpAreas", e.target.value)} className={ctl("helpAreas")} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred teaching language (optional)" name="teachingLanguage" error={err("teachingLanguage")}>
                  {(p) => (
                    <select {...p} value={values.teachingLanguage} onChange={(e) => set("teachingLanguage", e.target.value)} className={ctl("teachingLanguage")}>
                      <option value="">Choose…</option>
                      {TEACHING_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Preferred start date (optional)" name="startDate" error={err("startDate")}>
                  {(p) => <input {...p} type="date" min={todayIst} value={values.startDate} onChange={(e) => set("startDate", e.target.value)} className={ctl("startDate")} />}
                </Field>
              </div>
              <Field label="Additional notes (optional)" name="notes" error={err("notes")}>
                {(p) => <textarea {...p} rows={3} maxLength={INTAKE_LIMITS.textArea} value={values.notes} onChange={(e) => set("notes", e.target.value)} className={ctl("notes")} />}
              </Field>
            </fieldset>

            <fieldset className="space-y-4 rounded-card border border-line bg-surface p-4 sm:p-5" data-field="preferences" tabIndex={-1}>
              <legend className="px-1"><h2 className="text-lg font-bold">Preferred class timings (optional)</h2></legend>
              <p className="flex items-start gap-2 rounded-control border border-info/40 bg-info/10 p-3 text-base text-ink">
                <Clock className="mt-1 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                <span>{IST_NOTICE}</span>
              </p>
              {err("preferences") && <p className="text-sm font-medium text-danger">{err("preferences")}</p>}
              {prefs.length > 0 && (
                <ul className="space-y-3">
                  {prefs.map((row, i) => (
                    <li key={row.key} className="rounded-control border border-line-strong p-3">
                      <p className="mb-2 text-sm font-semibold text-ink-muted">Preferred time {i + 1}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Subject" name={`preferences.${i}.subjectId`} error={err(`preferences.${i}.subjectId`)}>
                          {(p) => (
                            <select {...p} value={row.subjectId} onChange={(e) => updatePref(row.key, { subjectId: e.target.value })} className={ctl(`preferences.${i}.subjectId`)}>
                              <option value="">Choose…</option>
                              {chosenSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                        </Field>
                        <Field label="Day" name={`preferences.${i}.weekday`} error={err(`preferences.${i}.weekday`)}>
                          {(p) => (
                            <select {...p} value={row.weekday} onChange={(e) => updatePref(row.key, { weekday: e.target.value })} className={ctl(`preferences.${i}.weekday`)}>
                              {WEEKDAYS.map((d) => <option key={d.value} value={String(d.value)}>{d.label}</option>)}
                            </select>
                          )}
                        </Field>
                        <Field label="Starts (IST)" name={`preferences.${i}.start`} error={err(`preferences.${i}.start`)}>
                          {(p) => <input {...p} type="time" step={900} value={row.start} onChange={(e) => updatePref(row.key, { start: e.target.value })} className={ctl(`preferences.${i}.start`)} />}
                        </Field>
                        <Field label="Ends (IST)" name={`preferences.${i}.end`} error={err(`preferences.${i}.end`)}>
                          {(p) => <input {...p} type="time" step={900} value={row.end} onChange={(e) => updatePref(row.key, { end: e.target.value })} className={ctl(`preferences.${i}.end`)} />}
                        </Field>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button type="button" variant="ghost" icon={Trash2} onClick={() => removePref(row.key)} aria-label={`Remove preferred time ${i + 1}`}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="lg" icon={Plus} onClick={addPref} disabled={values.subjectIds.length === 0 || prefs.length >= INTAKE_LIMITS.preferences}>
                {prefs.length ? "Add another preferred time" : "Add a preferred time"}
              </Button>
              {values.subjectIds.length === 0 && <p className="text-sm text-ink-muted">Choose the subjects first.</p>}
            </fieldset>

            <fieldset className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5">
              <legend className="px-1"><h2 className="text-lg font-bold">Agreement</h2></legend>
              <label className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 text-base ${errors.consent ? "border-rose-400" : "border-line-strong"}`}>
                <input
                  type="checkbox"
                  data-field="consent"
                  checked={values.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? "consent-error" : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-teal-400"
                />
                <span>
                  I agree that Xello Tuition may use these details to contact me and to process this tuition application.{" "}
                  <span className="text-danger">*<span className="sr-only"> (required)</span></span>
                </span>
              </label>
              {errors.consent && <p id="consent-error" className="text-sm font-medium text-danger">{errors.consent}</p>}
              {privacyUrl ? (
                <p className="text-sm text-ink-muted">
                  Read how Xello Tuition handles your details in the{" "}
                  <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-text underline">
                    privacy notice
                  </a>
                  .
                </p>
              ) : (
                <p className="text-sm text-ink-muted">The privacy notice is not available yet.</p>
              )}
            </fieldset>

            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Review details
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <Button type="button" variant="ghost" icon={Pencil} onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`break-words text-base ${mono ? "font-mono" : ""} ${value ? "text-ink" : "text-ink-subtle"}`}>{value || "Not given"}</dd>
    </div>
  );
}
