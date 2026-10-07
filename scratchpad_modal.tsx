"use client";

import { useMemo, useRef, useState } from "react";
import {
  X,
  UserPlus,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  BookOpen,
  BookPlus,
  Link2,
  Unlink,
  Users,
  Save,
  Search,
} from "lucide-react";
import { TIMEZONES } from "@/lib/timezones";
import { ALL_GRADES } from "@/lib/grades";
import { BOARD_OPTIONS, COUNTRIES, MEDIUM_OPTIONS, STUDENT_STATUSES, findCountry } from "@/lib/constants";
import { checkInternationalPhone, isValidEmail } from "@/lib/validation";
import { ClientApiError, apiRequest, errorMessage, newIdempotencyKey } from "@/lib/client-api";
import { ModalShell } from "@/components/ui/ModalShell";
import { FieldError, FormErrorSummary, focusField, inputClass } from "@/components/ui/FormFeedback";
import { QuickAddSubjectModal } from "@/components/subjects/QuickAddSubjectModal";

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
  color?: string | null;
}

export interface TeacherOption {
  id: string;
  name: string;
  subjects: string;
  active: boolean;
}

export interface StudentFormRecord {
  id: string;
  studentCode: string;
  name: string;
  grade: string;
  board: string;
  medium: string;
  status: string;
  guardianName: string;
  whatsappNumber: string;
  email: string | null;
  country: string;
  timeZone: string;
  preferredTimings: string | null;
  learningGoals: string | null;
  coordinatorNotes: string | null;
  enrolments?: { id: string; subjectId: string; teacherId: string | null; teacher?: { id: string; name: string; active?: boolean } | null }[];
}

interface GuardianMatch {
  id: string;
  name: string;
  whatsappNumber: string;
  country: string;
  timeZone: string;
  students: { id: string; name: string; studentCode: string; status: string }[];
}

interface Row {
  key: string;
  subjectId: string;
  teacherId: string;
  credits: string;
}

interface StudentFormModalProps {
  mode: "create" | "edit";
  student?: StudentFormRecord;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (student: any, message: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Student name",
  grade: "Class / grade",
  board: "Board",
  medium: "Medium",
  guardianName: "Guardian name",
  whatsappNumber: "WhatsApp number",
  guardianId: "Guardian",
  email: "Email",
  country: "Country",
  timeZone: "Time zone",
  status: "Status",
  enrolments: "Subjects",
  "package.name": "Package name",
  "package.totalCredits": "Total classes",
  "package.price": "Package price",
  "package.startDate": "Start date",
  "package.expiryDate": "Expiry date",
};

const inputBase = "w-full rounded-xl border bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 font-medium focus:outline-hidden";
const today = () => new Date().toISOString().slice(0, 10);
let rowCounter = 0;
const newRowKey = () => `row-${Date.now().toString(36)}-${(rowCounter++).toString(36)}`;

function withCurrent(options: string[], current?: string | null) {
  return current && !options.includes(current) ? [current, ...options] : options;
}

export function StudentFormModal({ mode, student, subjects, teachers, onClose, onSuccess }: StudentFormModalProps) {
  const isEdit = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  // 1. Student details
  const [name, setName] = useState(student?.name ?? "");
  const [grade, setGrade] = useState(student?.grade ?? "");
  const [board, setBoard] = useState(student?.board ?? "CBSE");
  const [medium, setMedium] = useState(student?.medium ?? "English");
  const [status, setStatus] = useState(student?.status ?? "ACTIVE");

  // 2. Guardian & region
  const [guardianName, setGuardianName] = useState(student?.guardianName ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(student?.whatsappNumber ?? "+971 ");
  const [email, setEmail] = useState(student?.email ?? "");
  const [country, setCountry] = useState(student?.country ?? "UAE");
  const [timeZone, setTimeZone] = useState(student?.timeZone ?? "Asia/Dubai");
  const [preferredTimings, setPreferredTimings] = useState(student?.preferredTimings ?? "");
  const [learningGoals, setLearningGoals] = useState(student?.learningGoals ?? "");
  const [coordinatorNotes, setCoordinatorNotes] = useState(student?.coordinatorNotes ?? "");

  const [guardianMatches, setGuardianMatches] = useState<GuardianMatch[]>([]);
  const [lookedUpPhone, setLookedUpPhone] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [linkedGuardian, setLinkedGuardian] = useState<GuardianMatch | null>(null);

  // 3. Subjects & trainers
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>(subjects);
  const [rows, setRows] = useState<Row[]>(() => {
    if (isEdit && student?.enrolments?.length) {
      return student.enrolments.map((e) => ({
        key: e.id,
        subjectId: e.subjectId,
        teacherId: e.teacherId ?? "",
        credits: "",
      }));
    }
    if (isEdit) return [];
    return [{ key: newRowKey(), subjectId: "", teacherId: "", credits: "20" }];
  });
  const [quickSubjectRowKey, setQuickSubjectRowKey] = useState<string | null>(null);
  const [quickSubjectOpen, setQuickSubjectOpen] = useState(false);

  // 4. Package
  const [includePackage, setIncludePackage] = useState(!isEdit);
  const [packageName, setPackageName] = useState(isEdit ? "Credit Booster Package" : "Multi-Subject Booster Package");
  const [totalCredits, setTotalCredits] = useState(isEdit ? "10" : "20");
  const [packagePrice, setPackagePrice] = useState(isEdit ? "9000" : "18000");
  const [startDate, setStartDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Trainer choices: active trainers plus any inactive trainer already assigned (edit).
  const teacherChoices = useMemo(() => {
    const list = teachers.filter((t) => t.active);
    for (const enr of student?.enrolments ?? []) {
      if (enr.teacher && !list.some((t) => t.id === enr.teacher!.id)) {
        list.push({ id: enr.teacher.id, name: `${enr.teacher.name} (inactive)`, subjects: "", active: false });
      }
    }
    return list;
  }, [teachers, student]);

  const allocatedTotal = rows.reduce((sum, r) => sum + (Number(r.credits) || 0), 0);
  const phoneCanonical = whatsappNumber.replace(/\D/g, "");
  const matchesForCurrentPhone = lookedUpPhone === phoneCanonical ? guardianMatches : [];

  const clearFieldError = (...fields: string[]) =>
    setFieldErrors((prev) => {
      if (!fields.some((f) => prev[f])) return prev;
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });

  const err = (field: string) => fieldErrors[field];

  const handleCountryChange = (value: string) => {
    setCountry(value);
    const option = findCountry(value);
    if (!option) return;
    setTimeZone(option.timeZone);
    if (linkedGuardian) return;
    const digits = whatsappNumber.replace(/\D/g, "");
    const isPrefixOnly = !digits || COUNTRIES.some((c) => c.dialCode.replace("+", "") === digits);
    if (isPrefixOnly) setWhatsappNumber(`${option.dialCode} `);
  };

  const lookupGuardians = async () => {
    if (isEdit || linkedGuardian) return;
    const check = checkInternationalPhone(whatsappNumber);
    if (!check.ok || lookedUpPhone === phoneCanonical) return;
    setLookupState("loading");
    try {
      const data = await apiRequest<{ guardians: GuardianMatch[] }>(
        `/api/guardians?phone=${encodeURIComponent(check.canonical)}`
      );
      setGuardianMatches(data.guardians ?? []);
      setLookedUpPhone(phoneCanonical);
      setLookupState("done");
    } catch {
      // Lookup is a convenience; creating a separate guardian still works.
      setLookupState("error");
    }
  };

  const linkGuardian = (g: GuardianMatch) => {
    setLinkedGuardian(g);
    setGuardianName(g.name);
    setWhatsappNumber(g.whatsappNumber);
    if (findCountry(g.country)) setCountry(g.country);
    if (g.timeZone) setTimeZone(g.timeZone);
    clearFieldError("guardianName", "whatsappNumber", "guardianId");
  };

  const unlinkGuardian = () => {
    setLinkedGuardian(null);
    setGuardianMatches([]);
    setLookedUpPhone("");
    setLookupState("idle");
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: newRowKey(), subjectId: "", teacherId: "", credits: "0" }]);
    clearFieldError("enrolments");
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const handleSubjectCreated = (subject: SubjectOption) => {
    setSubjectsList((prev) => (prev.some((s) => s.id === subject.id) ? prev : [...prev, subject].sort((a, b) => a.name.localeCompare(b.name))));
    if (quickSubjectRowKey) {
      updateRow(quickSubjectRowKey, { subjectId: subject.id });
    } else if (!rows.some((r) => r.subjectId === subject.id)) {
      setRows((prev) => [...prev, { key: newRowKey(), subjectId: subject.id, teacherId: "", credits: "0" }]);
    }
    setQuickSubjectRowKey(null);
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Student name is required.";
    if (!grade.trim()) errors.grade = "Choose the class / grade.";
    if (!linkedGuardian) {
      if (!guardianName.trim()) errors.guardianName = "Parent / guardian name is required.";
      const phone = checkInternationalPhone(whatsappNumber);
      if (!phoneCanonical || !phone.ok) errors.whatsappNumber = phone.error || "Enter the WhatsApp number with country code.";
    }
    if (email.trim() && !isValidEmail(email.trim().toLowerCase())) errors.email = "Enter a valid email address or leave it blank.";

    if (!isEdit && rows.length === 0) errors.enrolments = "Add at least one subject.";
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (!r.subjectId) errors[`enrolments.${i}.subjectId`] = "Choose a subject.";
      else if (seen.has(r.subjectId)) errors[`enrolments.${i}.subjectId`] = "This subject is already listed.";
      seen.add(r.subjectId);
    });

    if (includePackage) {
      const total = Number(totalCredits);
      if (!Number.isInteger(total) || total < 1 || total > 500) errors["package.totalCredits"] = "Enter a whole number of classes (1–500).";
      const price = Number(packagePrice);
      if (packagePrice.trim() === "" || !Number.isInteger(price) || price < 0) errors["package.price"] = "Enter the price in whole rupees (0 or more).";
      if (!startDate) errors["package.startDate"] = "Choose a start date.";
      if (expiryDate && startDate && expiryDate <= startDate) errors["package.expiryDate"] = "Expiry must be after the start date.";
      if (rows.length === 0) errors.enrolments = "Add at least one subject to allocate the package classes.";
      rows.forEach((r, i) => {
        const credits = Number(r.credits || 0);
        if (!Number.isInteger(credits) || credits < 0) errors[`package.allocations.${i}.allocatedCredits`] = "Whole number, 0 or more.";
      });
      if (Number.isInteger(total) && allocatedTotal !== total) {
        errors["package.totalCredits"] = `Subject classes add up to ${allocatedTotal}, but the package total is ${total}. Adjust them or use "Set total".`;
      }
    }
    return errors;
  };

  const buildPayload = () => {
    const enrolments = rows.map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || null }));
    const pkg = includePackage
      ? {
          name: packageName.trim() || undefined,
          totalCredits: Number(totalCredits),
          price: Number(packagePrice),
          startDate,
          expiryDate: expiryDate || null,
          allocations: rows.map((r) => ({ subjectId: r.subjectId, allocatedCredits: Number(r.credits || 0) })),
        }
      : null;
    const common = {
      name: name.trim(),
      grade,
      board,
      medium,
      email: email.trim() || null,
      country,
      timeZone,
      preferredTimings: preferredTimings.trim() || null,
      learningGoals: learningGoals.trim() || null,
      coordinatorNotes: coordinatorNotes.trim() || null,
      enrolments,
    };
    if (isEdit) {
      return { ...common, status, guardianName: guardianName.trim(), whatsappNumber: whatsappNumber.trim(), newPackage: pkg };
    }
    return linkedGuardian
      ? { ...common, guardianId: linkedGuardian.id, initialPackage: pkg }
      : { ...common, guardianName: guardianName.trim(), whatsappNumber: whatsappNumber.trim(), initialPackage: pkg };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setFormError("Please correct the highlighted fields.");
      focusField(formRef.current, Object.keys(errors)[0]);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await apiRequest<{ student: any; replayed?: boolean; message?: string }>(
        isEdit ? `/api/students/${student!.id}` : "/api/students",
        { method: isEdit ? "PATCH" : "POST", body: buildPayload(), idempotencyKey: isEdit ? undefined : idempotencyKey }
      );
      const unassigned = rows.filter((r) => !r.teacherId).length;
      const message = isEdit
        ? data.message || `Student "${data.student.name}" updated.`
        : `Student "${data.student.name}" (${data.student.studentCode}) registered${
            data.replayed ? " — it was already saved, no duplicate created" : ""
          }.${unassigned ? ` ${unassigned} subject(s) still need a trainer.` : ""}`;
      onSuccess(data.student, message);
    } catch (error) {
      const apiErr = error instanceof ClientApiError ? error : null;
      setFieldErrors(apiErr?.fieldErrors ?? {});
      setFormError(errorMessage(error, "Could not save the student."));
      const first = Object.keys(apiErr?.fieldErrors ?? {})[0];
      if (first) focusField(formRef.current, first);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const titleId = isEdit ? "edit-student-title" : "add-student-title";
  const guardianLocked = Boolean(linkedGuardian);

  return (
    <>
    <ModalShell labelledBy={titleId} onClose={onClose} closeDisabled={submitting || quickSubjectOpen}>
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-2xl bg-teal-500/10 border border-teal-500/20 p-2.5 text-teal-300 shrink-0">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
              {isEdit ? "Edit Student Profile" : "Enroll New Student"}
              {isEdit && student && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/30 text-teal-300">
                  {student.studentCode}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {isEdit
                ? "Update academic details, guardian contact, subject trainers and packages."
                : "Student profile, guardian contact, subject enrolments and an optional first package."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-touch-target flex items-center justify-center shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-5 space-y-5 text-xs">
        <FormErrorSummary
          message={formError}
          fieldErrors={fieldErrors}
          labels={FIELD_LABELS}
          onFocusField={(f) => focusField(formRef.current, f)}
        />

        {/* Section 1 */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">1. Student Academic Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="student-name" className="block font-medium text-slate-300 mb-1">
                Student Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="student-name"
                data-field="name"
                type="text"
                autoComplete="off"
                value={name}
                aria-invalid={!!err("name")}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                placeholder="e.g. Farhan Basheer"
                className={inputClass(inputBase, !!err("name"))}
              />
              <FieldError message={err("name")} />
            </div>

            <div>
              <label htmlFor="student-grade" className="block font-medium text-slate-300 mb-1">
                Class / Grade <span className="text-rose-400">*</span>
              </label>
              <select
                id="student-grade"
                data-field="grade"
                value={grade}
                aria-invalid={!!err("grade")}
                onChange={(e) => { setGrade(e.target.value); clearFieldError("grade"); }}
                className={inputClass(inputBase, !!err("grade"))}
              >
                <option value="" className="bg-slate-900">Select class / grade…</option>
                {grade && !ALL_GRADES.some((g) => g.value === grade) && (
                  <option value={grade} className="bg-slate-900">{grade}</option>
                )}
                {(["Kindergarten", "Primary School", "Middle School", "High School", "Higher Secondary (+1 & +2)"] as const).map(
                  (category) => (
                    <optgroup key={category} label={category} className="bg-slate-900 text-slate-300">
                      {ALL_GRADES.filter((g) => g.category === category).map((g) => (
                        <option key={g.value} value={g.value} className="bg-slate-900 text-white">{g.label}</option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
              <FieldError message={err("grade")} />
            </div>

            <div>
              <label htmlFor="student-board" className="block font-medium text-slate-300 mb-1">Curriculum Board</label>
              <select
                id="student-board"
                data-field="board"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className={inputClass(inputBase, !!err("board"))}
              >
                {withCurrent(BOARD_OPTIONS, board).map((b) => (
                  <option key={b} value={b} className="bg-slate-900">{b}</option>
                ))}
              </select>
              <FieldError message={err("board")} />
            </div>

            <div>
              <label htmlFor="student-medium" className="block font-medium text-slate-300 mb-1">Medium of Instruction</label>
              <select
                id="student-medium"
                data-field="medium"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                className={inputClass(inputBase, !!err("medium"))}
              >
                {withCurrent(MEDIUM_OPTIONS, medium).map((m) => (
                  <option key={m} value={m} className="bg-slate-900">{m}</option>
                ))}
              </select>
            </div>

            {isEdit && (
              <div className="sm:col-span-2">
                <label htmlFor="student-status" className="block font-medium text-slate-300 mb-1">Enrolment Status</label>
                <select
                  id="student-status"
                  data-field="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass(inputBase, !!err("status"))}
                >
                  {STUDENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Section 2 */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">2. Parent / Guardian & Region (Kerala & GCC)</h4>

          {guardianLocked && linkedGuardian && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-teal-500/30 bg-teal-500/10 p-3">
              <div className="flex items-start gap-2 text-teal-200">
                <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Linked to existing guardian <strong>{linkedGuardian.name}</strong> ({linkedGuardian.whatsappNumber}) — sibling of{" "}
                  {linkedGuardian.students.map((s) => s.name).join(", ") || "no other students yet"}.
                </span>
              </div>
              <button
                type="button"
                onClick={unlinkGuardian}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 min-h-[36px] font-semibold text-slate-200 hover:bg-slate-800 shrink-0"
              >
                <Unlink className="h-3.5 w-3.5" /> Unlink
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="student-whatsapp" className="block font-medium text-slate-300 mb-1">
                Guardian WhatsApp (with country code) <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="student-whatsapp"
                  data-field="whatsappNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  disabled={guardianLocked}
                  value={whatsappNumber}
                  aria-invalid={!!err("whatsappNumber")}
                  onChange={(e) => { setWhatsappNumber(e.target.value); clearFieldError("whatsappNumber"); }}
                  onBlur={lookupGuardians}
                  placeholder="+971 50 123 4567"
                  className={`${inputClass(inputBase, !!err("whatsappNumber"))} font-mono disabled:opacity-60 min-w-0`}
                />
                {!isEdit && !guardianLocked && (
                  <button
                    type="button"
                    onClick={lookupGuardians}
                    title="Check for an existing guardian with this number"
                    aria-label="Check for an existing guardian with this number"
                    className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 text-slate-300 hover:bg-slate-800 min-w-[44px] flex items-center justify-center"
                  >
                    {lookupState === "loading" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <FieldError message={err("whatsappNumber")} />
              {isEdit && (
                <p className="mt-1 text-[10px] text-slate-500">Guardian name and number are shared with any siblings linked to this guardian.</p>
              )}
            </div>

            <div>
              <label htmlFor="student-guardian" className="block font-medium text-slate-300 mb-1">
                Parent / Guardian Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="student-guardian"
                data-field="guardianName"
                type="text"
                autoComplete="off"
                disabled={guardianLocked}
                value={guardianName}
                aria-invalid={!!err("guardianName")}
                onChange={(e) => { setGuardianName(e.target.value); clearFieldError("guardianName"); }}
                placeholder="e.g. Basheer Ahmed"
                className={`${inputClass(inputBase, !!err("guardianName"))} disabled:opacity-60`}
              />
              <FieldError message={err("guardianName") || err("guardianId")} />
            </div>

            {!guardianLocked && matchesForCurrentPhone.length > 0 && (
              <div className="sm:col-span-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2" role="status">
                <div className="flex items-start gap-2 text-amber-200 font-semibold">
                  <Users className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    This WhatsApp number is already used by {matchesForCurrentPhone.length === 1 ? "a guardian" : `${matchesForCurrentPhone.length} guardians`}.
                    Link to keep siblings together, or continue to create a separate guardian record.
                  </span>
                </div>
                {matchesForCurrentPhone.map((g) => (
                  <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-slate-950/60 border border-slate-800 p-2.5">
                    <div className="text-slate-200">
                      <span className="font-bold">{g.name}</span> · {g.whatsappNumber}
                      <div className="text-[11px] text-slate-400">
                        Children: {g.students.length ? g.students.map((s) => `${s.name} (${s.studentCode})`).join(", ") : "none"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => linkGuardian(g)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-500/15 border border-teal-500/30 px-3 py-1.5 min-h-[36px] font-bold text-teal-200 hover:bg-teal-500/25 shrink-0"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Link as sibling
                    </button>
                  </div>
                ))}
              </div>
            )}
            {lookupState === "error" && !guardianLocked && (
              <p className="sm:col-span-2 text-[11px] text-slate-500">Could not check for existing guardians. You can still save — a new guardian record will be created.</p>
            )}

            <div>
              <label htmlFor="student-email" className="block font-medium text-slate-300 mb-1">
                Contact Email <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="student-email"
                data-field="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                aria-invalid={!!err("email")}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                placeholder="parent@example.com"
                className={inputClass(inputBase, !!err("email"))}
              />
              <FieldError message={err("email")} />
            </div>

            <div>
              <label htmlFor="student-country" className="block font-medium text-slate-300 mb-1">
                Country <span className="text-rose-400">*</span>
              </label>
              <select
                id="student-country"
                data-field="country"
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={inputClass(inputBase, !!err("country"))}
              >
                {withCurrent(COUNTRIES.map((c) => c.value), country).map((value) => {
                  const c = findCountry(value);
                  return (
                    <option key={value} value={value} className="bg-slate-900">
                      {c ? `${c.flag} ${c.label}` : value}
                    </option>
                  );
                })}
              </select>
              <FieldError message={err("country")} />
            </div>

            <div>
              <label htmlFor="student-tz" className="block font-medium text-slate-300 mb-1">
                Display Time Zone <span className="text-rose-400">*</span>
              </label>
              <select
                id="student-tz"
                data-field="timeZone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className={inputClass(inputBase, !!err("timeZone"))}
              >
                {withCurrent(TIMEZONES.map((t) => t.value), timeZone).map((value) => {
                  const tz = TIMEZONES.find((t) => t.value === value);
                  return (
                    <option key={value} value={value} className="bg-slate-900">
                      {tz ? `${tz.label} (${tz.offset})` : value}
                    </option>
                  );
                })}
              </select>
              <FieldError message={err("timeZone")} />
            </div>

            <div>
              <label htmlFor="student-timings" className="block font-medium text-slate-300 mb-1">
                Preferred Class Timings <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="student-timings"
                data-field="preferredTimings"
                type="text"
                value={preferredTimings}
                onChange={(e) => setPreferredTimings(e.target.value)}
                placeholder="e.g. Weekdays 6:00 PM – 8:00 PM GST"
                className={inputClass(inputBase, !!err("preferredTimings"))}
              />
              <FieldError message={err("preferredTimings")} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="student-goals" className="block font-medium text-slate-300 mb-1">
                Learning Goals <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="student-goals"
                data-field="learningGoals"
                rows={2}
                value={learningGoals}
                onChange={(e) => setLearningGoals(e.target.value)}
                placeholder="e.g. Improve CBSE Class 10 Maths scores before board exams"
                className={inputClass(inputBase, !!err("learningGoals"))}
              />
              <FieldError message={err("learningGoals")} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="student-notes" className="block font-medium text-slate-300 mb-1">
                Coordinator Notes <span className="text-slate-500 font-normal">(optional, internal)</span>
              </label>
              <textarea
                id="student-notes"
                data-field="coordinatorNotes"
                rows={2}
                value={coordinatorNotes}
                onChange={(e) => setCoordinatorNotes(e.target.value)}
                className={inputClass(inputBase, !!err("coordinatorNotes"))}
              />
              <FieldError message={err("coordinatorNotes")} />
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div className="space-y-3 pt-3 border-t border-slate-800" data-field="enrolments" tabIndex={-1}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-teal-400" />
                3. Subjects & Assigned Trainers ({rows.length})
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                A trainer can be assigned later — choose &ldquo;Assign later&rdquo; if none is confirmed yet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setQuickSubjectRowKey(null); setQuickSubjectOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 min-h-[36px] text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-all"
              >
                <BookPlus className="h-3.5 w-3.5" />
                New Subject
              </button>
              <button
                type="button"
                onClick={addRow}
                disabled={rows.length >= subjectsList.length}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 min-h-[36px] text-xs font-bold text-teal-300 hover:bg-teal-500/20 transition-all disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Subject
              </button>
            </div>
          </div>
          <FieldError message={err("enrolments")} />

          {subjectsList.length === 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
              No subjects exist yet. Use &ldquo;New Subject&rdquo; to create one.
            </div>
          )}

          <div className="space-y-2.5">
            {rows.map((row, idx) => {
              const usedElsewhere = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.subjectId));
              return (
                <div
                  key={row.key}
                  className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5"
                >
                  <div className="flex items-center gap-2 sm:min-w-[90px] sm:pt-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-200">Subject #{idx + 1}</span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <div>
                      <label htmlFor={`row-subject-${row.key}`} className="sr-only">Subject {idx + 1}</label>
                      <select
                        id={`row-subject-${row.key}`}
                        data-field={`enrolments.${idx}.subjectId`}
                        value={row.subjectId}
                        aria-invalid={!!err(`enrolments.${idx}.subjectId`)}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setQuickSubjectRowKey(row.key);
                            setQuickSubjectOpen(true);
                            return;
                          }
                          updateRow(row.key, { subjectId: e.target.value });
                          clearFieldError(`enrolments.${idx}.subjectId`);
                        }}
                        className={inputClass(`${inputBase} bg-slate-900`, !!err(`enrolments.${idx}.subjectId`))}
                      >
                        <option value="" className="bg-slate-900">Select subject…</option>
                        {subjectsList.map((s) => (
                          <option key={s.id} value={s.id} disabled={usedElsewhere.has(s.id)} className="bg-slate-900">
                            {s.name} ({s.code}){usedElsewhere.has(s.id) ? " — already added" : ""}
                          </option>
                        ))}
                        <option value="__NEW__" className="bg-slate-800 text-teal-300 font-bold">➕ Add a new subject…</option>
                      </select>
                      <FieldError message={err(`enrolments.${idx}.subjectId`)} />
                    </div>

                    <div>
                      <label htmlFor={`row-teacher-${row.key}`} className="sr-only">Trainer for subject {idx + 1}</label>
                      <select
                        id={`row-teacher-${row.key}`}
                        data-field={`enrolments.${idx}.teacherId`}
                        value={row.teacherId}
                        aria-invalid={!!err(`enrolments.${idx}.teacherId`)}
                        onChange={(e) => {
                          updateRow(row.key, { teacherId: e.target.value });
                          clearFieldError(`enrolments.${idx}.teacherId`);
                        }}
                        className={inputClass(`${inputBase} bg-slate-900`, !!err(`enrolments.${idx}.teacherId`))}
                      >
                        <option value="" className="bg-slate-900">Trainer: Assign later</option>
                        {teacherChoices.map((t) => (
                          <option key={t.id} value={t.id} className="bg-slate-900">
                            Trainer: {t.name}{t.subjects ? ` (${t.subjects})` : ""}
                          </option>
                        ))}
                      </select>
                      <FieldError message={err(`enrolments.${idx}.teacherId`)} />
                    </div>
                  </div>

                  {(rows.length > 1 || isEdit) && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove subject ${idx + 1}`}
                      className="self-end sm:self-start rounded-xl p-2 min-touch-target flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {isEdit && student?.enrolments && rows.length < student.enrolments.length && (
            <p className="text-[11px] text-amber-300">
              Removed subjects will be unenrolled when you save. Past sessions and attendance are not affected.
            </p>
          )}
        </div>

        {/* Section 4 */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              4. {isEdit ? "Issue a New Package" : "Initial Package Purchase"}
            </h4>
            <label className="flex items-center gap-2 font-semibold text-slate-300 cursor-pointer text-xs min-h-[36px]">
              <input
                type="checkbox"
                checked={includePackage}
                onChange={(e) => setIncludePackage(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-teal-500"
              />
              {isEdit ? "Create a new package now" : "Create the first package now"}
            </label>
          </div>
          {!includePackage && !isEdit && (
            <p className="text-[11px] text-slate-500">No package or invoice will be created. You can add a package later from the student profile.</p>
          )}

          {includePackage && (
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label htmlFor="pkg-name" className="block text-[11px] font-medium text-slate-300 mb-1">Package Name</label>
                  <input
                    id="pkg-name"
                    data-field="package.name"
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className={inputClass(inputBase, !!err("package.name"))}
                  />
                  <FieldError message={err("package.name")} />
                </div>
                <div>
                  <label htmlFor="pkg-total" className="block text-[11px] font-medium text-slate-300 mb-1">Total Classes *</label>
                  <input
                    id="pkg-total"
                    data-field="package.totalCredits"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={totalCredits}
                    aria-invalid={!!err("package.totalCredits")}
                    onChange={(e) => { setTotalCredits(e.target.value); clearFieldError("package.totalCredits"); }}
                    className={`${inputClass(inputBase, !!err("package.totalCredits"))} font-bold`}
                  />
                </div>
                <div>
                  <label htmlFor="pkg-price" className="block text-[11px] font-medium text-slate-300 mb-1">Price (₹, whole rupees) *</label>
                  <input
                    id="pkg-price"
                    data-field="package.price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={packagePrice}
                    aria-invalid={!!err("package.price")}
                    onChange={(e) => { setPackagePrice(e.target.value); clearFieldError("package.price"); }}
                    className={`${inputClass(inputBase, !!err("package.price"))} font-bold`}
                  />
                  <FieldError message={err("package.price")} />
                </div>
                <div>
                  <label htmlFor="pkg-start" className="block text-[11px] font-medium text-slate-300 mb-1">Start Date *</label>
                  <input
                    id="pkg-start"
                    data-field="package.startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); clearFieldError("package.startDate", "package.expiryDate"); }}
                    className={inputClass(inputBase, !!err("package.startDate"))}
                  />
                  <FieldError message={err("package.startDate")} />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="pkg-expiry" className="block text-[11px] font-medium text-slate-300 mb-1">
                    Expiry Date <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    id="pkg-expiry"
                    data-field="package.expiryDate"
                    type="date"
                    value={expiryDate}
                    min={startDate || undefined}
                    onChange={(e) => { setExpiryDate(e.target.value); clearFieldError("package.expiryDate"); }}
                    className={`${inputClass(inputBase, !!err("package.expiryDate"))} sm:max-w-[50%]`}
                  />
                  <FieldError message={err("package.expiryDate")} />
                </div>
              </div>
              <FieldError message={err("package.totalCredits")} />
              {Number(packagePrice) > 0 && (
                <p className="text-[11px] text-slate-400">An unpaid invoice for ₹{Number(packagePrice).toLocaleString("en-IN")} (due in 14 days) will be created.</p>
              )}

              <div className="pt-2.5 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-300">Classes per subject:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                        allocatedTotal === Number(totalCredits)
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      Allocated: {allocatedTotal} / {totalCredits || 0}
                    </span>
                    {allocatedTotal !== Number(totalCredits) && allocatedTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => { setTotalCredits(String(allocatedTotal)); clearFieldError("package.totalCredits"); }}
                        className="text-[11px] text-teal-300 underline hover:text-teal-200 min-h-[32px]"
                      >
                        Set total to {allocatedTotal}
                      </button>
                    )}
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Add a subject above to allocate classes.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {rows.map((row, idx) => {
                      const subject = subjectsList.find((s) => s.id === row.subjectId);
                      const field = `package.allocations.${idx}.allocatedCredits`;
                      return (
                        <div key={row.key} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor={`alloc-${row.key}`} className="flex items-center gap-1.5 min-w-0">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: subject?.color || "#06b6d4" }} />
                              <span className="text-xs font-semibold text-slate-300 truncate">{subject?.name || `Subject #${idx + 1}`}</span>
                            </label>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                id={`alloc-${row.key}`}
                                data-field={field}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={row.credits}
                                aria-invalid={!!err(field)}
                                onChange={(e) => { updateRow(row.key, { credits: e.target.value }); clearFieldError(field, "package.totalCredits"); }}
                                className={`w-16 min-h-[36px] rounded-lg border bg-slate-900 p-1 text-center font-bold text-white text-xs focus:outline-hidden ${err(field) ? "border-rose-500/70" : "border-slate-700 focus:border-teal-400"}`}
                              />
                              <span className="text-[10px] text-slate-400">cls</span>
                            </div>
                          </div>
                          <FieldError message={err(field) || err(`package.allocations.${idx}.subjectId`)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[#0c1220]/95 backdrop-blur border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 min-h-[44px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-5 py-2.5 min-h-[44px] font-bold text-slate-950 hover:brightness-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-50 shadow-lg shadow-teal-500/20 transition-all active:scale-95"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Enroll Student
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>

    {/* Rendered outside the dialog so its overlay is positioned against the viewport. */}
    {quickSubjectOpen && (
      <QuickAddSubjectModal
        onClose={() => { setQuickSubjectOpen(false); setQuickSubjectRowKey(null); }}
        onSuccess={handleSubjectCreated}
      />
    )}
    </>
  );
}
