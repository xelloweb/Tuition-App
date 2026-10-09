"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookPlus, Link2, Plus, Save, Search, Trash2, Unlink, UserPlus, Users, X, RefreshCw } from "lucide-react";
import { ALL_GRADES } from "@/lib/grades";
import { BOARD_OPTIONS, COUNTRIES, MEDIUM_OPTIONS, STUDENT_STATUSES, findCountry } from "@/lib/constants";
import { checkInternationalPhone, isValidEmail } from "@/lib/validation";
import { ClientApiError, apiRequest, errorMessage, newIdempotencyKey } from "@/lib/client-api";
import { formatTimeOnly } from "@/lib/timezones";
import type { AdmissionDraftItem, IntakeContext } from "@/lib/services/admission-drafts";
import type { AdmissionPrefill } from "@/lib/intake-prefill";
import type { ExistingPaymentOptions } from "@/lib/services/existing-payment-packages";
import { PACKAGE_PRESETS } from "@/lib/package-presets";
import { ModalShell } from "@/components/ui/ModalShell";
import { FormErrorSummary, focusField } from "@/components/ui/FormFeedback";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { QuickAddSubjectModal } from "@/components/subjects/QuickAddSubjectModal";
import { Stepper, StepDef } from "./admission/Stepper";
import { SlotDraft, WeeklyScheduleStep, toMinutes, fromMinutes, weekdayLabel } from "./admission/WeeklyScheduleStep";
import { ReviewData, ReviewStep } from "./admission/ReviewStep";

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
  draftData?: string | null;
  enrolments?: {
    id: string;
    subjectId: string;
    teacherId: string | null;
    teacher?: { id: string; name: string; active?: boolean } | null;
    timetableSlots?: {
      id: string;
      teacherId: string | null;
      weekday: number;
      startMinutes: number;
      endMinutes: number;
      timeZone: string;
    }[];
  }[];
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

type StepId = "details" | "subjects" | "package" | "schedule" | "review";
type Booking = { weeklySlots: number; bookedClasses: number; notBooked: string[] };

/** What a saved admission draft contains (also reads drafts saved by the old form). */
export interface AdmissionSnapshot {
  version: 1;
  step: StepId;
  name: string;
  grade: string;
  board: string;
  medium: string;
  guardianName: string;
  whatsappNumber: string;
  email: string;
  country: string;
  preferredTimings: string;
  learningGoals: string;
  coordinatorNotes: string;
  linkedGuardian: GuardianMatch | null;
  rows: Row[];
  includePackage: boolean;
  packageName: string;
  totalCredits: string;
  packagePrice: string;
  startDate: string;
  expiryDate: string;
  slots: SlotDraft[];
}

interface StudentFormModalProps {
  mode: "create" | "edit";
  student?: StudentFormRecord;
  /** Resume an admission draft (create mode). */
  draft?: AdmissionDraftItem | null;
  /** Starting values from a parent form submission (create mode, no draft yet). */
  prefill?: AdmissionPrefill | null;
  /** The parent submission this admission converts; confirming marks it Converted. */
  intake?: IntakeContext | null;
  /** Step to open first (e.g. "package" from the profile's "Purchase new package"). */
  startStep?: StepId;
  subjects: SubjectOption[];
  teachers: TeacherOption[];
  existingPayment?: ExistingPaymentOptions | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (student: any, message: string) => void;
  /** Called after a draft is saved, or removed by confirming it. */
  onDraftsChanged?: () => void;
}

/** Packages created during admission use 60-minute classes. */
const CLASS_MINUTES = 60;

export { PACKAGE_PRESETS };

const FIELD_LABELS: Record<string, string> = {
  name: "Student name",
  grade: "Class / grade",
  board: "Board",
  medium: "Medium",
  guardianName: "Parent / guardian name",
  whatsappNumber: "WhatsApp number",
  guardianId: "Guardian",
  email: "Email",
  country: "Country",
  status: "Status",
  enrolments: "Subjects",
  "package.name": "Package name",
  "package.totalCredits": "Total classes",
  "package.price": "Package price",
  "package.startDate": "Start date",
  "package.expiryDate": "Expiry date",
  slots: "Weekly slots",
};

const labelFor = (field: string) => {
  const slot = /^slots\.(\d+)\./.exec(field);
  if (slot) return `Weekly slot ${Number(slot[1]) + 1}`;
  const enr = /^enrolments\.(\d+)\./.exec(field);
  if (enr) return `Subject ${Number(enr[1]) + 1}`;
  return FIELD_LABELS[field];
};

function stepForField(field: string): StepId {
  if (field.startsWith("slots")) return "schedule";
  if (field.startsWith("package")) return "package";
  if (field.startsWith("enrolments")) return "subjects";
  return "details";
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
let rowCounter = 0;
const newRowKey = () => `row-${Date.now().toString(36)}-${(rowCounter++).toString(36)}`;
const withCurrent = (options: string[], current?: string | null) => (current && !options.includes(current) ? [current, ...options] : options);

function readSnapshot(json: string | null | undefined): Partial<AdmissionSnapshot> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Partial<AdmissionSnapshot>) : {};
  } catch {
    return {};
  }
}

export function StudentFormModal({ mode, student, draft, prefill, intake, startStep, subjects, teachers, existingPayment, onClose, onSuccess, onDraftsChanged }: StudentFormModalProps) {
  const isEdit = mode === "edit";
  const legacyDraft = isEdit && student?.status === "DRAFT";
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const initial = useMemo<Partial<AdmissionSnapshot>>(
    () => (draft ? readSnapshot(draft.data) : prefill ? prefill : readSnapshot(student?.draftData)),
    [draft, prefill, student]
  );
  /** Set when this admission comes from a parent form submission (directly or via its draft). */
  const intakeInfo = isEdit ? null : intake ?? draft?.submission ?? null;

  const [currentExistingPayment, setCurrentExistingPayment] = useState<ExistingPaymentOptions | null>(existingPayment ?? null);

  useEffect(() => {
    if (existingPayment !== undefined) {
      setCurrentExistingPayment(existingPayment);
      return;
    }
    if (isEdit && student?.id) {
      apiRequest<{ options: ExistingPaymentOptions }>(`/api/students/${student.id}/existing-payment`)
        .then((res) => {
          if (res?.options) {
            setCurrentExistingPayment(res.options);
            const usable = Boolean(
              res.options.unsetPackages.length > 0 ||
              res.options.unlinkedInvoices.length > 0 ||
              res.options.unusedTotal > 0
            );
            if (usable && !res.options.hasActiveWorkingPackage) {
              setPackageMode("EXISTING_PAYMENT");
              setIncludePackage(true);
              if (res.options.unsetPackages[0]?.name) setPackageName(res.options.unsetPackages[0].name);
              if (res.options.unsetPackages[0]?.totalCredits) setTotalCredits(String(res.options.unsetPackages[0].totalCredits));
              if (res.options.unsetPackages[0]?.price) setPackagePrice(String(res.options.unsetPackages[0].price));
              else if (res.options.availablePaidAmount) setPackagePrice(String(res.options.availablePaidAmount));
            }
          }
        })
        .catch(() => {});
    }
  }, [isEdit, student?.id, existingPayment]);

  const activeExistingPayment = currentExistingPayment ?? existingPayment;

  const hasUsableExistingPayment = Boolean(
    activeExistingPayment &&
    (activeExistingPayment.unsetPackages.length > 0 ||
     activeExistingPayment.unlinkedInvoices.length > 0 ||
     activeExistingPayment.unusedTotal > 0)
  );

  const [packageMode, setPackageMode] = useState<"EXISTING_PAYMENT" | "NEW_PURCHASE">(() => {
    if (isEdit && hasUsableExistingPayment && !activeExistingPayment?.hasActiveWorkingPackage) {
      return "EXISTING_PAYMENT";
    }
    return "NEW_PURCHASE";
  });

  const steps: (StepDef & { id: StepId })[] = useMemo(
    () => [
      { id: "details", label: "Student details" },
      { id: "subjects", label: "Subjects & trainers" },
      { id: "package", label: isEdit ? (hasUsableExistingPayment && packageMode === "EXISTING_PAYMENT" ? "Assign package" : "Package & fees") : "Package & fees" },
      { id: "schedule", label: "Weekly timetable" },
      { id: "review", label: isEdit && !legacyDraft ? "Review & save" : "Review & confirm" },
    ],
    [isEdit, legacyDraft, hasUsableExistingPayment, packageMode]
  );
  const [stepIndex, setStepIndex] = useState(() => Math.max(0, steps.findIndex((s) => s.id === (startStep ?? initial.step))));
  const currentStep = steps[stepIndex];
  const hasSchedule = steps.some((s) => s.id === "schedule");

  // 1. Student details
  const [name, setName] = useState(initial.name ?? student?.name ?? "");
  const [grade, setGrade] = useState(initial.grade ?? student?.grade ?? "");
  const [board, setBoard] = useState(initial.board ?? student?.board ?? "CBSE");
  const [medium, setMedium] = useState(initial.medium ?? student?.medium ?? "English");
  const [status, setStatus] = useState(legacyDraft ? "ACTIVE" : student?.status ?? "ACTIVE");
  const [guardianName, setGuardianName] = useState(initial.guardianName ?? student?.guardianName ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber ?? student?.whatsappNumber ?? "+91 ");
  const [email, setEmail] = useState(initial.email ?? student?.email ?? "");
  const [country, setCountry] = useState(initial.country ?? student?.country ?? "India");
  const [preferredTimings, setPreferredTimings] = useState(initial.preferredTimings ?? student?.preferredTimings ?? "");
  const [learningGoals, setLearningGoals] = useState(initial.learningGoals ?? student?.learningGoals ?? "");
  const [coordinatorNotes, setCoordinatorNotes] = useState(initial.coordinatorNotes ?? student?.coordinatorNotes ?? "");

  const [guardianMatches, setGuardianMatches] = useState<GuardianMatch[]>([]);
  const [lookedUpPhone, setLookedUpPhone] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [linkedGuardian, setLinkedGuardian] = useState<GuardianMatch | null>(initial.linkedGuardian ?? null);

  // 2. Subjects & trainers
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>(subjects);
  const [rows, setRows] = useState<Row[]>(() => {
    if (initial.rows?.length) return initial.rows;
    if (isEdit && student?.enrolments?.length) {
      return student.enrolments.map((e) => ({ key: e.id, subjectId: e.subjectId, teacherId: e.teacherId ?? "", credits: "" }));
    }
    if (isEdit) return [];
    return [{ key: newRowKey(), subjectId: "", teacherId: "", credits: "12" }];
  });
  const [quickSubjectRowKey, setQuickSubjectRowKey] = useState<string | null>(null);
  const [quickSubjectOpen, setQuickSubjectOpen] = useState(false);

  // 3. Package & fees
  const [includePackage, setIncludePackage] = useState(() => {
    if (initial.includePackage !== undefined) return initial.includePackage;
    if (isEdit && hasUsableExistingPayment && !activeExistingPayment?.hasActiveWorkingPackage) return true;
    return !isEdit;
  });
  const [packageName, setPackageName] = useState(() => {
    if (initial.packageName) return initial.packageName;
    if (isEdit && activeExistingPayment?.unsetPackages[0]?.name) return activeExistingPayment.unsetPackages[0].name;
    return "Monthly Package (3 Classes/week)";
  });
  const [totalCredits, setTotalCredits] = useState(() => {
    if (initial.totalCredits) return initial.totalCredits;
    if (isEdit && activeExistingPayment?.unsetPackages[0]?.totalCredits) return String(activeExistingPayment.unsetPackages[0].totalCredits);
    return "12";
  });
  const [packagePrice, setPackagePrice] = useState(() => {
    if (initial.packagePrice) return initial.packagePrice;
    if (isEdit && activeExistingPayment?.unsetPackages[0]?.price) return String(activeExistingPayment.unsetPackages[0].price);
    if (isEdit && activeExistingPayment?.availablePaidAmount) return String(activeExistingPayment.availablePaidAmount);
    return "3000";
  });
  const [startDate, setStartDate] = useState(() => {
    if (initial.startDate) return initial.startDate;
    if (isEdit && activeExistingPayment?.unsetPackages[0]?.startDate) return activeExistingPayment.unsetPackages[0].startDate.slice(0, 10);
    return today();
  });
  const [expiryDate, setExpiryDate] = useState(() => {
    if (initial.expiryDate) return initial.expiryDate;
    if (isEdit && activeExistingPayment?.unsetPackages[0]?.expiryDate) return activeExistingPayment.unsetPackages[0].expiryDate.slice(0, 10);
    return "";
  });

  // 4. Weekly schedule
  const [slots, setSlots] = useState<SlotDraft[]>(() => {
    if (initial.slots?.length) return initial.slots;
    if (isEdit && student?.enrolments?.length) {
      const existing: SlotDraft[] = [];
      for (const enr of student.enrolments) {
        if (enr.timetableSlots?.length) {
          for (const s of enr.timetableSlots) {
            existing.push({
              key: s.id,
              subjectId: enr.subjectId,
              teacherId: s.teacherId ?? "",
              weekday: String(s.weekday),
              start: fromMinutes(s.startMinutes),
              end: fromMinutes(s.endMinutes),
            });
          }
        }
      }
      if (existing.length > 0) return existing;
    }
    return [];
  });

  // In edit mode, if slots were not included on student.enrolments, load them from the timetable endpoint
  useEffect(() => {
    if (!isEdit || !student?.id || slots.length > 0) return;
    let active = true;
    apiRequest<{
      timetable?: {
        slots: { id: string; enrolmentId: string; teacherId: string | null; weekday: number; startMinutes: number; endMinutes: number }[];
        enrolments: { id: string; subjectId: string }[];
      };
    }>(`/api/students/${student.id}/timetable`)
      .then((res) => {
        if (!active || !res.timetable?.slots?.length) return;
        const enrMap = new Map(res.timetable.enrolments.map((e) => [e.id, e.subjectId]));
        const loaded: SlotDraft[] = res.timetable.slots.map((s) => ({
          key: s.id,
          subjectId: enrMap.get(s.enrolmentId) ?? "",
          teacherId: s.teacherId ?? "",
          weekday: String(s.weekday),
          start: fromMinutes(s.startMinutes),
          end: fromMinutes(s.endMinutes),
        }));
        if (loaded.length > 0) setSlots(loaded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isEdit, student?.id]);

  const calculateAllocations = (targetTotal: number, currentRows: Row[], currentSlots: SlotDraft[] = slots) => {
    const validRows = currentRows.filter((r) => r.subjectId);
    if (validRows.length === 0 || targetTotal <= 0) return currentRows;

    const slotCounts = new Map<string, number>();
    for (const r of validRows) slotCounts.set(r.subjectId, 0);
    for (const s of currentSlots) {
      if (slotCounts.has(s.subjectId)) {
        slotCounts.set(s.subjectId, (slotCounts.get(s.subjectId) || 0) + 1);
      }
    }
    const totalSlots = currentSlots.filter((s) => slotCounts.has(s.subjectId)).length;

    if (totalSlots > 0) {
      let rem = targetTotal;
      return currentRows.map((r, i) => {
        if (!r.subjectId) return r;
        const count = slotCounts.get(r.subjectId) || 0;
        const isLast = i === currentRows.map((x) => x.subjectId).lastIndexOf(r.subjectId);
        const share = isLast ? rem : Math.min(rem, Math.round((count / totalSlots) * targetTotal));
        rem = Math.max(0, rem - share);
        return { ...r, credits: String(share) };
      });
    }

    const base = Math.floor(targetTotal / validRows.length);
    const remainder = targetTotal % validRows.length;
    let validIndex = 0;
    return currentRows.map((r) => {
      if (!r.subjectId) return r;
      const extra = validIndex < remainder ? 1 : 0;
      validIndex++;
      return { ...r, credits: String(base + extra) };
    });
  };

  const applyPreset = (preset: typeof PACKAGE_PRESETS[0]) => {
    setPackageName(preset.name);
    setTotalCredits(preset.totalCredits);
    setPackagePrice(preset.price);
    const target = Number(preset.totalCredits);
    setRows((prev) => calculateAllocations(target, prev, slots));
    clearFieldError("package.name", "package.totalCredits", "package.price");
  };
  const [booking, setBooking] = useState<Booking | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Drafts
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(draft?.updatedAt ?? null);
  const [draftNotice, setDraftNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const snapshot = (): AdmissionSnapshot => ({
    version: 1,
    step: currentStep.id,
    name, grade, board, medium, guardianName, whatsappNumber, email, country, preferredTimings, learningGoals, coordinatorNotes,
    linkedGuardian, rows, includePackage, packageName, totalCredits, packagePrice, startDate, expiryDate, slots,
  });
  // Unsaved-change tracking ignores which step is open.
  const comparable = JSON.stringify({ ...snapshot(), step: null, status });
  const [savedSnapshot, setSavedSnapshot] = useState(comparable);
  const dirty = comparable !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Focus a field after switching to the step that holds it.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const field = pendingFocus.current;
    pendingFocus.current = null;
    requestAnimationFrame(() => focusField(formRef.current, field));
  }, [stepIndex, fieldErrors]);

  const goToField = (field: string) => {
    const target = steps.findIndex((s) => s.id === stepForField(field));
    pendingFocus.current = field;
    if (target >= 0 && target !== stepIndex) setStepIndex(target);
    else requestAnimationFrame(() => focusField(formRef.current, field));
  };

  const teacherChoices = useMemo(() => {
    const list = teachers.filter((t) => t.active);
    for (const enr of student?.enrolments ?? []) {
      if (enr.teacher && !list.some((t) => t.id === enr.teacher!.id)) {
        list.push({ id: enr.teacher.id, name: `${enr.teacher.name} (inactive)`, subjects: "", active: false });
      }
    }
    return list;
  }, [teachers, student]);

  const subjectName = (id: string) => subjectsList.find((s) => s.id === id)?.name ?? "Subject";
  const teacherName = (id: string) => teacherChoices.find((t) => t.id === id)?.name.replace(/ \(inactive\)$/, "") ?? null;
  const allocatedTotal = rows.reduce((sum, r) => sum + (Number(r.credits) || 0), 0);
  const phoneCanonical = whatsappNumber.replace(/\D/g, "");
  const matchesForCurrentPhone = lookedUpPhone === phoneCanonical ? guardianMatches : [];
  const err = (field: string) => fieldErrors[field];

  const clearFieldError = (...fields: string[]) =>
    setFieldErrors((prev) => {
      if (!fields.some((f) => prev[f])) return prev;
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });

  const handleCountryChange = (value: string) => {
    setCountry(value);
    const option = findCountry(value);
    if (!option || linkedGuardian) return;
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
      const data = await apiRequest<{ guardians: GuardianMatch[] }>(`/api/guardians?phone=${encodeURIComponent(check.canonical)}`);
      setGuardianMatches(data.guardians ?? []);
      setLookedUpPhone(phoneCanonical);
      setLookupState("done");
    } catch {
      // Lookup is a convenience; creating a separate guardian still works.
      setLookupState("error");
    }
  };

  // Pre-filled from a parent submission: check once for a known parent with this number (siblings).
  const autoLookup = useRef(false);
  useEffect(() => {
    if (autoLookup.current || !intakeInfo || draft || linkedGuardian) return;
    // The flag is set when the lookup actually runs, so a remount (React strict mode) still looks up once.
    const timer = window.setTimeout(() => {
      autoLookup.current = true;
      void lookupGuardians();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkGuardian = (g: GuardianMatch) => {
    setLinkedGuardian(g);
    setGuardianName(g.name);
    setWhatsappNumber(g.whatsappNumber);
    if (findCountry(g.country)) setCountry(g.country);
    clearFieldError("guardianName", "whatsappNumber", "guardianId");
  };

  const unlinkGuardian = () => {
    setLinkedGuardian(null);
    setGuardianMatches([]);
    setLookedUpPhone("");
    setLookupState("idle");
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    const before = rows.find((r) => r.key === key);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    // Keep weekly slots attached to the subject they were added for.
    if (before && patch.subjectId !== undefined && patch.subjectId !== before.subjectId && before.subjectId) {
      setSlots((prev) => prev.map((s) => (s.subjectId === before.subjectId ? { ...s, subjectId: patch.subjectId! } : s)));
    }
  };
  const addRow = () => {
    setRows((prev) => [...prev, { key: newRowKey(), subjectId: "", teacherId: "", credits: "0" }]);
    clearFieldError("enrolments");
  };
  const removeRow = (key: string) => {
    const row = rows.find((r) => r.key === key);
    setRows((prev) => prev.filter((r) => r.key !== key));
    if (row?.subjectId) setSlots((prev) => prev.filter((s) => s.subjectId !== row.subjectId));
  };

  const handleSubjectCreated = (subject: SubjectOption) => {
    setSubjectsList((prev) => (prev.some((s) => s.id === subject.id) ? prev : [...prev, subject].sort((a, b) => a.name.localeCompare(b.name))));
    if (quickSubjectRowKey) updateRow(quickSubjectRowKey, { subjectId: subject.id });
    else if (!rows.some((r) => r.subjectId === subject.id)) setRows((prev) => [...prev, { key: newRowKey(), subjectId: subject.id, teacherId: "", credits: "0" }]);
    setQuickSubjectRowKey(null);
  };

  const validateStep = (id: StepId): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (id === "details") {
      if (!name.trim()) errors.name = "Student name is required.";
      if (!grade.trim()) errors.grade = "Choose the class / grade.";
      if (!linkedGuardian) {
        if (!guardianName.trim()) errors.guardianName = "Parent / guardian name is required.";
        const phone = checkInternationalPhone(whatsappNumber);
        if (!phoneCanonical || !phone.ok) errors.whatsappNumber = phone.error || "Enter the WhatsApp number with country code.";
      }
      if (email.trim() && !isValidEmail(email.trim().toLowerCase())) errors.email = "Enter a valid email address or leave it blank.";
    }
    if (id === "subjects") {
      if (!isEdit && rows.length === 0) errors.enrolments = "Add at least one subject.";
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        if (!r.subjectId) errors[`enrolments.${i}.subjectId`] = "Choose a subject.";
        else if (seen.has(r.subjectId)) errors[`enrolments.${i}.subjectId`] = "This subject is already listed.";
        seen.add(r.subjectId);
      });
    }
    if (id === "package" && includePackage) {
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
      // Re-balance credits automatically if they do not match total, instead of blocking
      if (Number.isInteger(total) && total > 0 && allocatedTotal !== total) {
        setRows((prev) => calculateAllocations(total, prev, slots));
      }
    }
    if (id === "schedule") {
      slots.forEach((s, i) => {
        const start = toMinutes(s.start);
        const end = toMinutes(s.end);
        if (start === null) errors[`slots.${i}.start`] = "Enter a start time.";
        if (end === null) errors[`slots.${i}.end`] = "Enter an end time.";
        else if (start !== null && end <= start) errors[`slots.${i}.end`] = "End time must be after the start time.";
      });
    }
    return errors;
  };

  const slotPayload = () =>
    slots.map((s) => ({
      subjectId: s.subjectId,
      teacherId: rows.find((r) => r.subjectId === s.subjectId)?.teacherId || null,
      weekday: Number(s.weekday),
      start: s.start,
      end: s.end,
    }));

  const buildPayload = () => {
    const enrolments = rows.map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || null }));
    const validRows = rows.filter((r) => r.subjectId);
    const targetTotal = Number(totalCredits) || 0;
    let finalAllocations: { subjectId: string; allocatedCredits: number }[] = [];
    const manualSum = validRows.reduce((sum, r) => sum + (Number(r.credits) || 0), 0);
    if (manualSum === targetTotal && targetTotal > 0) {
      finalAllocations = validRows.map((r) => ({ subjectId: r.subjectId, allocatedCredits: Number(r.credits) || 0 }));
    } else if (targetTotal > 0 && validRows.length > 0) {
      const balanced = calculateAllocations(targetTotal, rows, slots);
      finalAllocations = balanced.filter((r) => r.subjectId).map((r) => ({ subjectId: r.subjectId, allocatedCredits: Number(r.credits) || 0 }));
    }

    const pkg = includePackage
      ? {
          name: packageName.trim() || undefined,
          totalCredits: Number(totalCredits),
          price: Number(packagePrice),
          startDate,
          expiryDate: expiryDate || null,
          allocations: finalAllocations,
        }
      : null;
    const common = {
      name: name.trim(),
      grade,
      board,
      medium,
      email: email.trim() || null,
      country,
      preferredTimings: preferredTimings.trim() || null,
      learningGoals: learningGoals.trim() || null,
      coordinatorNotes: coordinatorNotes.trim() || null,
      enrolments,
    };
      if (isEdit) {
        return {
          ...common,
          status,
          guardianName: guardianName.trim(),
          whatsappNumber: whatsappNumber.trim(),
          newPackage: pkg
            ? {
                ...pkg,
                assignFromExistingPayment: hasUsableExistingPayment && packageMode === "EXISTING_PAYMENT",
                source: activeExistingPayment?.unsetPackages[0]
                  ? { type: "PACKAGE", id: activeExistingPayment.unsetPackages[0].id }
                  : activeExistingPayment?.unlinkedInvoices[0]
                  ? { type: "INVOICE", id: activeExistingPayment.unlinkedInvoices[0].id }
                  : { type: "PAYMENTS" },
              }
            : null,
          slots: slotPayload(),
          ...(legacyDraft ? { draftData: null } : {}),
        };
      }
    return {
      ...common,
      ...(linkedGuardian ? { guardianId: linkedGuardian.id } : { guardianName: guardianName.trim(), whatsappNumber: whatsappNumber.trim() }),
      initialPackage: pkg,
      slots: slotPayload(),
      ...(draftId ? { draftId } : {}),
      ...(intakeInfo ? { submissionId: intakeInfo.id } : {}),
    };
  };

  /** Shows server errors next to their fields, on the step that holds the first one. */
  const showServerError = (error: unknown, fallback: string) => {
    const apiErr = error instanceof ClientApiError ? error : null;
    const fe = apiErr?.fieldErrors ?? {};
    setFieldErrors(fe);
    setFormError(errorMessage(error, fallback));
    const ordered = Object.keys(fe).sort((a, b) => steps.findIndex((s) => s.id === stepForField(a)) - steps.findIndex((s) => s.id === stepForField(b)));
    if (ordered[0]) goToField(ordered[0]);
  };

  const showClientErrors = (errors: Record<string, string>) => {
    setFieldErrors(errors);
    setFormError("Please correct the highlighted fields.");
    goToField(Object.keys(errors)[0]);
  };

  /** Runs every server check without saving, before the review step. */
  const runCheck = async (): Promise<boolean> => {
    setChecking(true);
    setFormError("");
    try {
      const data = await apiRequest<{ booking: Booking | null }>("/api/students", { method: "POST", body: { ...buildPayload(), checkOnly: true } });
      setBooking(data.booking);
      return true;
    } catch (error) {
      showServerError(error, "Could not check the admission. Try again.");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const goNext = async () => {
    const errors = validateStep(currentStep.id);
    if (Object.keys(errors).length) return showClientErrors(errors);
    setFieldErrors({});
    setFormError("");
    const next = steps[stepIndex + 1];
    if (next?.id === "review" && !isEdit && !(await runCheck())) return;
    setStepIndex(stepIndex + 1);
  };

  const confirm = async () => {
    if (submittingRef.current) return;
    const all = steps.reduce<Record<string, string>>((acc, s) => ({ ...acc, ...validateStep(s.id) }), {});
    if (Object.keys(all).length) return showClientErrors(all);

    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await apiRequest<{ student: any; replayed?: boolean; message?: string; booking?: Booking | null }>(
        isEdit ? `/api/students/${student!.id}` : "/api/students",
        { method: isEdit ? "PATCH" : "POST", body: buildPayload(), idempotencyKey: isEdit ? undefined : idempotencyKey }
      );
      setSavedSnapshot(comparable);
      const unassigned = rows.filter((r) => !r.teacherId).length;
      const booked = data.booking?.bookedClasses ?? 0;
      const issues = data.booking?.notBooked.length ?? 0;
      const message = isEdit
        ? data.message || `Student "${data.student.name}" updated.`
        : [
            `Student "${data.student.name}" (${data.student.studentCode}) admitted${data.replayed ? " (it was already saved; no duplicate created)" : ""}.`,
            booked ? `${booked} class${booked === 1 ? "" : "es"} booked for the next 4 weeks.` : "",
            issues ? `${issues} slot issue${issues === 1 ? "" : "s"} to review on the student's timetable.` : "",
            unassigned ? `${unassigned} subject${unassigned === 1 ? "" : "s"} still need a trainer.` : "",
          ]
            .filter(Boolean)
            .join(" ");
      if (draftId) onDraftsChanged?.();
      onSuccess(data.student, message);
    } catch (error) {
      showServerError(error, "Could not save the student.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    setDraftNotice(null);
    const snap = snapshot();
    try {
      const res = draftId
        ? await apiRequest<{ draft: AdmissionDraftItem }>(`/api/admission-drafts/${draftId}`, { method: "PATCH", body: { data: snap, baseUpdatedAt: draftUpdatedAt } })
        : await apiRequest<{ draft: AdmissionDraftItem }>("/api/admission-drafts", { method: "POST", body: { data: snap, ...(intakeInfo ? { submissionId: intakeInfo.id } : {}) } });
      setDraftId(res.draft.id);
      setDraftUpdatedAt(res.draft.updatedAt);
      setSavedSnapshot(comparable);
      setDraftNotice({
        tone: "success",
        text: intakeInfo
          ? `Draft saved at ${formatTimeOnly(res.draft.updatedAt)} IST. Continue it from submission ${intakeInfo.reference} or under “Admission drafts” on the Students page.`
          : `Draft saved at ${formatTimeOnly(res.draft.updatedAt)} IST. Find it under “Admission drafts” on the Students page.`,
      });
      onDraftsChanged?.();
    } catch (error) {
      setDraftNotice({ tone: "error", text: errorMessage(error, "Could not save the draft.") });
    } finally {
      setSavingDraft(false);
    }
  };

  const requestClose = () => {
    if (submitting || savingDraft) return;
    if (dirty && !window.confirm(isEdit ? "Discard your unsaved changes?" : "Discard this admission? Use “Save draft” first to keep it.")) return;
    onClose();
  };

  const reviewData: ReviewData = {
    student: { name, grade, board, medium, status: isEdit && !legacyDraft ? STUDENT_STATUSES.find((s) => s.value === status)?.label ?? status : undefined },
    guardian: {
      name: guardianName,
      whatsapp: whatsappNumber,
      email,
      country,
      siblingOf: linkedGuardian ? linkedGuardian.students.map((s) => s.name).join(", ") || null : null,
    },
    subjects: rows.filter((r) => r.subjectId).map((r) => ({ name: subjectName(r.subjectId), trainer: r.teacherId ? teacherName(r.teacherId) : null })),
    pkg: includePackage
      ? (() => {
          const validRows = rows.filter((r) => r.subjectId);
          const targetTotal = Number(totalCredits) || 0;
          const manualSum = validRows.reduce((sum, r) => sum + (Number(r.credits) || 0), 0);
          const effective = manualSum === targetTotal && targetTotal > 0
            ? validRows.map((r) => ({ subjectId: r.subjectId, allocatedCredits: Number(r.credits) || 0 }))
            : calculateAllocations(targetTotal, rows, slots).filter((r) => r.subjectId).map((r) => ({ subjectId: r.subjectId, allocatedCredits: Number(r.credits) || 0 }));
          return {
            name: packageName.trim() || `${totalCredits}-class package`,
            totalCredits: Number(totalCredits) || 0,
            price: Number(packagePrice) || 0,
            startDate,
            expiryDate,
            allocations: effective.map((a) => ({ subject: subjectName(a.subjectId), credits: a.allocatedCredits })),
          };
        })()
      : null,
    schedule: hasSchedule
      ? rows
          .filter((r) => r.subjectId)
          .map((r) => ({
            subject: subjectName(r.subjectId),
            items: slots
              .filter((s) => s.subjectId === r.subjectId)
              .map((s) => ({ day: weekdayLabel(s.weekday), start: s.start, end: s.end, trainer: teacherName(r.teacherId) || "Trainer Not Assigned" })),
          }))
      : null,
    booking: hasSchedule ? booking : null,
    warnings: [
      ...rows.filter((r) => r.subjectId && !r.teacherId).map((r) => `${subjectName(r.subjectId)}: Trainer Not Assigned. Classes cannot be booked until a trainer is assigned.`),
      ...(hasSchedule ? rows.filter((r) => r.subjectId && !slots.some((s) => s.subjectId === r.subjectId)).map((r) => `${subjectName(r.subjectId)} has no weekly slots.`) : []),
      ...(!isEdit && !includePackage ? ["No package: no classes will be booked until one is added."] : []),
    ],
  };

  const titleId = isEdit ? "edit-student-title" : "add-student-title";
  const guardianLocked = Boolean(linkedGuardian);
  const isLast = stepIndex === steps.length - 1;
  const ctl = (invalid: boolean) => `${controlClass} ${controlBorder(invalid)}`;

  return (
    <>
      <ModalShell labelledBy={titleId} onClose={requestClose} closeDisabled={submitting || quickSubjectOpen} maxWidth="max-w-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-ink">
              {isEdit ? (legacyDraft ? "Finish admission" : "Edit student") : draft ? "Continue admission" : intakeInfo ? "Start admission from parent form" : "Admit a student"}
              {isEdit && student && <span className="ml-2 align-middle font-mono text-sm font-normal text-ink-subtle">{student.studentCode}</span>}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {isEdit
                ? "Update details, subjects and trainers, or add a package. The weekly timetable is edited on the student's profile."
                : "Nothing is saved until you confirm on the last step. Use “Save draft” to finish later."}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">
          <Stepper steps={steps} current={stepIndex} onSelect={(i) => { setFormError(""); setStepIndex(i); }} />
        </div>

        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast) void confirm();
            else void goNext();
          }}
          noValidate
          className="mt-5 space-y-5"
        >
          <FormErrorSummary message={formError} fieldErrors={fieldErrors} labels={new Proxy(FIELD_LABELS, { get: (_t, k) => labelFor(String(k)) })} onFocusField={goToField} />
          {draftNotice && <Notice tone={draftNotice.tone} onDismiss={() => setDraftNotice(null)}>{draftNotice.text}</Notice>}
          {intakeInfo && currentStep.id !== "review" && (
            <Notice tone="info" title={`From parent form ${intakeInfo.reference}`}>
              Check every detail with the parent. Assign trainers, choose the package and confirm the weekly slots yourself: nothing
              is booked or reserved until you confirm the admission.
            </Notice>
          )}

          <h3 className="text-lg font-semibold text-ink">{currentStep.label}</h3>

          {currentStep.id === "details" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Student full name" name="name" required error={err("name")}>
                  {(p) => <input {...p} type="text" autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); clearFieldError("name"); }} className={ctl(!!err("name"))} />}
                </Field>
                <Field label="Class / grade" name="grade" required error={err("grade")}>
                  {(p) => (
                    <select {...p} value={grade} onChange={(e) => { setGrade(e.target.value); clearFieldError("grade"); }} className={ctl(!!err("grade"))}>
                      <option value="">Select class / grade…</option>
                      {grade && !ALL_GRADES.some((g) => g.value === grade) && <option value={grade}>{grade}</option>}
                      {(["Kindergarten", "Primary School", "Middle School", "High School", "Higher Secondary (+1 & +2)"] as const).map((category) => (
                        <optgroup key={category} label={category}>
                          {ALL_GRADES.filter((g) => g.category === category).map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Board" name="board" error={err("board")}>
                  {(p) => (
                    <select {...p} value={board} onChange={(e) => setBoard(e.target.value)} className={ctl(!!err("board"))}>
                      {withCurrent(BOARD_OPTIONS, board).map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Medium" name="medium" error={err("medium")}>
                  {(p) => (
                    <select {...p} value={medium} onChange={(e) => setMedium(e.target.value)} className={ctl(!!err("medium"))}>
                      {withCurrent(MEDIUM_OPTIONS, medium).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                </Field>
                {isEdit && !legacyDraft && (
                  <Field label="Status" name="status" error={err("status")} className="sm:col-span-2">
                    {(p) => (
                      <select {...p} value={status} onChange={(e) => setStatus(e.target.value)} className={ctl(!!err("status"))}>
                        {STUDENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    )}
                  </Field>
                )}
              </div>

              <fieldset className="space-y-4 border-t border-line pt-4">
                <legend className="sr-only">Parent or guardian</legend>
                <p className="font-semibold text-ink">Parent / guardian</p>
                {guardianLocked && linkedGuardian && (
                  <Notice tone="info" title={`Linked to ${linkedGuardian.name} (${linkedGuardian.whatsappNumber})`}>
                    <p>Sibling of {linkedGuardian.students.map((s) => s.name).join(", ") || "no other students yet"}.</p>
                    <Button type="button" variant="outline" size="sm" icon={Unlink} onClick={unlinkGuardian} className="mt-2">
                      Unlink
                    </Button>
                  </Notice>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="WhatsApp number (with country code)"
                    name="whatsappNumber"
                    required
                    error={err("whatsappNumber")}
                    hint={isEdit ? "Shared with any siblings linked to this guardian." : "We check for an existing parent with this number."}
                  >
                    {(p) => (
                      <div className="flex gap-2">
                        <input
                          {...p}
                          type="tel"
                          inputMode="tel"
                          autoComplete="off"
                          disabled={guardianLocked}
                          value={whatsappNumber}
                          onChange={(e) => { setWhatsappNumber(e.target.value); clearFieldError("whatsappNumber"); }}
                          onBlur={lookupGuardians}
                          className={`${ctl(!!err("whatsappNumber"))} min-w-0 font-mono`}
                        />
                        {!isEdit && !guardianLocked && (
                          <Button type="button" variant="secondary" onClick={lookupGuardians} aria-label="Check for an existing parent with this number" loading={lookupState === "loading"}>
                            {lookupState !== "loading" && <Search className="h-4 w-4" aria-hidden="true" />}
                          </Button>
                        )}
                      </div>
                    )}
                  </Field>
                  <Field label="Parent / guardian name" name="guardianName" required error={err("guardianName") || err("guardianId")}>
                    {(p) => (
                      <input {...p} type="text" autoComplete="off" disabled={guardianLocked} value={guardianName} onChange={(e) => { setGuardianName(e.target.value); clearFieldError("guardianName"); }} className={ctl(!!err("guardianName"))} />
                    )}
                  </Field>
                  {!guardianLocked && matchesForCurrentPhone.length > 0 && (
                    <div className="sm:col-span-2">
                      <Notice tone="warning" title={`This WhatsApp number already belongs to ${matchesForCurrentPhone.length === 1 ? "a parent" : `${matchesForCurrentPhone.length} parents`}`}>
                        <p>Link to keep siblings together, or continue to create a separate parent record.</p>
                        <ul className="mt-2 space-y-2">
                          {matchesForCurrentPhone.map((g) => (
                            <li key={g.id} className="flex flex-col gap-2 rounded-control border border-line bg-surface p-2.5 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-ink">
                                <Users className="mr-1 inline h-4 w-4" aria-hidden="true" />
                                <strong>{g.name}</strong> · {g.whatsappNumber}
                                <span className="block text-sm text-ink-subtle">
                                  Children: {g.students.length ? g.students.map((s) => `${s.name} (${s.studentCode})`).join(", ") : "none"}
                                </span>
                              </span>
                              <Button type="button" variant="secondary" size="sm" icon={Link2} onClick={() => linkGuardian(g)}>
                                Link as sibling
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </Notice>
                    </div>
                  )}
                  {lookupState === "error" && !guardianLocked && (
                    <p className="text-sm text-ink-subtle sm:col-span-2">Could not check for existing parents. You can continue; a new parent record will be created.</p>
                  )}
                  <Field label="Email (optional)" name="email" error={err("email")}>
                    {(p) => <input {...p} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }} className={ctl(!!err("email"))} />}
                  </Field>
                  <Field label="Country" name="country" required error={err("country")} hint="Class times are always shown in IST.">
                    {(p) => (
                      <select {...p} value={country} onChange={(e) => handleCountryChange(e.target.value)} className={ctl(!!err("country"))}>
                        {withCurrent(COUNTRIES.map((c) => c.value), country).map((value) => {
                          const c = findCountry(value);
                          return <option key={value} value={value}>{c ? c.label : value}</option>;
                        })}
                      </select>
                    )}
                  </Field>
                  <Field label="Preferred class timings (optional)" name="preferredTimings" error={err("preferredTimings")} className="sm:col-span-2">
                    {(p) => <input {...p} type="text" value={preferredTimings} onChange={(e) => setPreferredTimings(e.target.value)} placeholder="e.g. Weekdays after 6 PM IST" className={ctl(!!err("preferredTimings"))} />}
                  </Field>
                  <Field label="Learning goals (optional)" name="learningGoals" error={err("learningGoals")} className="sm:col-span-2">
                    {(p) => <textarea {...p} rows={2} value={learningGoals} onChange={(e) => setLearningGoals(e.target.value)} className={ctl(!!err("learningGoals"))} />}
                  </Field>
                  <Field label="Coordinator notes (optional, internal)" name="coordinatorNotes" error={err("coordinatorNotes")} className="sm:col-span-2">
                    {(p) => <textarea {...p} rows={2} value={coordinatorNotes} onChange={(e) => setCoordinatorNotes(e.target.value)} className={ctl(!!err("coordinatorNotes"))} />}
                  </Field>
                </div>
              </fieldset>
            </div>
          )}

          {currentStep.id === "subjects" && (
            <div className="space-y-3" data-field="enrolments" tabIndex={-1}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">A trainer can be assigned later: choose “Assign later” if none is confirmed yet.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" icon={BookPlus} onClick={() => { setQuickSubjectRowKey(null); setQuickSubjectOpen(true); }}>
                    New subject
                  </Button>
                  <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addRow} disabled={rows.length >= subjectsList.length}>
                    Add subject
                  </Button>
                </div>
              </div>
              {err("enrolments") && <p className="text-sm font-medium text-danger">{err("enrolments")}</p>}
              {subjectsList.length === 0 && <Notice tone="warning">No subjects exist yet. Use “New subject” to create one.</Notice>}
              <ul className="space-y-3">
                {rows.map((row, idx) => {
                  const usedElsewhere = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.subjectId));
                  return (
                    <li key={row.key} className="rounded-card border border-line p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                        <Field label={`Subject ${idx + 1}`} name={`enrolments.${idx}.subjectId`} error={err(`enrolments.${idx}.subjectId`)}>
                          {(p) => (
                            <select
                              {...p}
                              value={row.subjectId}
                              onChange={(e) => {
                                if (e.target.value === "__NEW__") {
                                  setQuickSubjectRowKey(row.key);
                                  setQuickSubjectOpen(true);
                                  return;
                                }
                                updateRow(row.key, { subjectId: e.target.value });
                                clearFieldError(`enrolments.${idx}.subjectId`);
                              }}
                              className={ctl(!!err(`enrolments.${idx}.subjectId`))}
                            >
                              <option value="">Select subject…</option>
                              {subjectsList.map((s) => (
                                <option key={s.id} value={s.id} disabled={usedElsewhere.has(s.id)}>
                                  {s.name} ({s.code}){usedElsewhere.has(s.id) ? " — already added" : ""}
                                </option>
                              ))}
                              <option value="__NEW__">Add a new subject…</option>
                            </select>
                          )}
                        </Field>
                        <Field label={`Trainer for subject ${idx + 1}`} name={`enrolments.${idx}.teacherId`} error={err(`enrolments.${idx}.teacherId`)}>
                          {(p) => (
                            <select {...p} value={row.teacherId} onChange={(e) => { updateRow(row.key, { teacherId: e.target.value }); clearFieldError(`enrolments.${idx}.teacherId`); }} className={ctl(!!err(`enrolments.${idx}.teacherId`))}>
                              <option value="">Assign later</option>
                              {teacherChoices.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}{t.subjects ? ` (${t.subjects})` : ""}</option>
                              ))}
                            </select>
                          )}
                        </Field>
                        {(rows.length > 1 || isEdit) && (
                          <div className="flex justify-end sm:pt-6">
                            <Button type="button" variant="ghost" size="sm" icon={Trash2} aria-label={`Remove subject ${idx + 1}`} onClick={() => removeRow(row.key)}>
                              <span className="sm:sr-only">Remove</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {isEdit && student?.enrolments && rows.length < student.enrolments.length && (
                <Notice tone="warning">Removed subjects are unenrolled when you save. Past classes and attendance are kept.</Notice>
              )}
            </div>
          )}

          {currentStep.id === "package" && (
            <div className="space-y-4">
              {isEdit && hasUsableExistingPayment && (
                <div className="space-y-3 rounded-card border border-teal-500/30 bg-teal-500/10 p-3 sm:p-4">
                  <div className="flex items-start gap-2.5">
                    <Link2 className="h-5 w-5 text-teal-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Payment Already Received</p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        This student has already paid ₹{Number(activeExistingPayment?.availablePaidAmount || activeExistingPayment?.unusedTotal || 0).toLocaleString("en-IN")}.
                        You can convert/map this payment to an active package without generating a new payment or extra fee.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-all ${packageMode === "EXISTING_PAYMENT" ? "border-teal-400 bg-teal-500/20 text-white" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>
                      <input
                        type="radio"
                        name="packageMode"
                        checked={packageMode === "EXISTING_PAYMENT"}
                        onChange={() => {
                          setPackageMode("EXISTING_PAYMENT");
                          setIncludePackage(true);
                        }}
                        className="mt-0.5 accent-teal-400"
                      />
                      <div>
                        <span className="block font-bold text-white">Assign using existing payment</span>
                        <span className="block text-slate-300 mt-0.5">Links existing payment. New payment created: ₹0.</span>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-all ${packageMode === "NEW_PURCHASE" ? "border-teal-400 bg-teal-500/20 text-white" : "border-slate-800 bg-slate-900/60 text-slate-400"}`}>
                      <input
                        type="radio"
                        name="packageMode"
                        checked={packageMode === "NEW_PURCHASE"}
                        onChange={() => setPackageMode("NEW_PURCHASE")}
                        className="mt-0.5 accent-teal-400"
                      />
                      <div>
                        <span className="block font-bold text-white">Purchase / Add new package</span>
                        <span className="block text-slate-300 mt-0.5">Creates a new invoice for parent to pay.</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              {(!isEdit || !hasUsableExistingPayment) && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={includePackage} onChange={(e) => setIncludePackage(e.target.checked)} className="h-5 w-5 accent-teal-400" />
                  {isEdit ? "Purchase a new package (creates a new invoice to collect)" : "Create the first package now"}
                </label>
              )}
              {!includePackage && (
                <p className="text-sm text-ink-subtle">
                  No package or invoice will be created{!isEdit ? ", so no classes can be booked yet" : ""}. You can add a package later from the student profile.
                </p>
              )}
              {includePackage && (
                <div className="space-y-4 rounded-card border border-line p-3 sm:p-4">
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2">Package Presets</p>
                    <div className="flex flex-wrap gap-2">
                      {PACKAGE_PRESETS.map((preset) => {
                        const isSelected = totalCredits === preset.totalCredits && packageName === preset.name;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className={`inline-flex items-center min-h-[44px] rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                              isSelected
                                ? "bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-xs"
                                : "bg-surface border-line text-ink-muted hover:border-teal-500/30 hover:text-ink"
                            }`}
                          >
                            {preset.label} (₹{Number(preset.price).toLocaleString("en-IN")})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Package name" name="package.name" error={err("package.name")} className="sm:col-span-3">
                      {(p) => <input {...p} type="text" value={packageName} onChange={(e) => setPackageName(e.target.value)} className={ctl(!!err("package.name"))} />}
                    </Field>
                    <Field label="Total classes" name="package.totalCredits" required error={err("package.totalCredits")}>
                      {(p) => (
                        <input
                          {...p}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={totalCredits}
                          onChange={(e) => {
                            setTotalCredits(e.target.value);
                            clearFieldError("package.totalCredits");
                            const target = Number(e.target.value);
                            if (Number.isInteger(target) && target > 0) {
                              setRows((prev) => calculateAllocations(target, prev, slots));
                            }
                          }}
                          className={`${ctl(!!err("package.totalCredits"))} tabular-nums`}
                        />
                      )}
                    </Field>
                    <Field label="Price (₹, whole rupees)" name="package.price" required error={err("package.price")}>
                      {(p) => <input {...p} type="number" inputMode="numeric" min={0} value={packagePrice} onChange={(e) => { setPackagePrice(e.target.value); clearFieldError("package.price"); }} className={`${ctl(!!err("package.price"))} tabular-nums`} />}
                    </Field>
                    <Field label="Start date" name="package.startDate" required error={err("package.startDate")}>
                      {(p) => <input {...p} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); clearFieldError("package.startDate", "package.expiryDate"); }} className={ctl(!!err("package.startDate"))} />}
                    </Field>
                    <Field label="Expiry date (optional)" name="package.expiryDate" error={err("package.expiryDate")}>
                      {(p) => <input {...p} type="date" value={expiryDate} min={startDate || undefined} onChange={(e) => { setExpiryDate(e.target.value); clearFieldError("package.expiryDate"); }} className={ctl(!!err("package.expiryDate"))} />}
                    </Field>
                  </div>
                  {isEdit && hasUsableExistingPayment && packageMode === "EXISTING_PAYMENT" ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                      ✅ <strong>No new invoice or payment created:</strong> The existing payment of ₹{Number(packagePrice).toLocaleString("en-IN")} will be linked directly to this package. Total collected remains unchanged.
                    </div>
                  ) : Number(packagePrice) > 0 ? (
                    <p className="text-sm text-ink-muted">An unpaid invoice for ₹{Number(packagePrice).toLocaleString("en-IN")} (due in 14 days) will be created.</p>
                  ) : null}
                  <div className="space-y-2 border-t border-line pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">Classes per subject</p>
                        <p className="text-xs text-ink-subtle">
                          The package determines total monthly classes. In the next step, you can set recurring weekly days and times for each subject.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const balanced = calculateAllocations(Number(totalCredits) || 0, rows, []);
                            setRows(balanced);
                            clearFieldError("package.totalCredits");
                          }}
                        >
                          Split evenly
                        </Button>
                        {slots.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const balanced = calculateAllocations(Number(totalCredits) || 0, rows, slots);
                              setRows(balanced);
                              clearFieldError("package.totalCredits");
                            }}
                          >
                            Sync with timetable ({slots.length} slots)
                          </Button>
                        )}
                        <p className={`text-sm font-semibold tabular-nums ${allocatedTotal === Number(totalCredits) ? "text-success" : "text-warning"}`}>
                          Allocated {allocatedTotal} of {totalCredits || 0}
                        </p>
                      </div>
                    </div>
                    {rows.length === 0 ? (
                      <p className="text-sm text-ink-subtle">Add a subject first to allocate classes.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {rows.map((row, idx) => {
                          const field = `package.allocations.${idx}.allocatedCredits`;
                          return (
                            <Field key={row.key} label={`${row.subjectId ? subjectName(row.subjectId) : `Subject ${idx + 1}`} classes`} name={field} error={err(field) || err(`package.allocations.${idx}.subjectId`)}>
                              {(p) => (
                                <input {...p} type="number" inputMode="numeric" min={0} value={row.credits} onChange={(e) => { updateRow(row.key, { credits: e.target.value }); clearFieldError(field, "package.totalCredits"); }} className={`${ctl(!!err(field))} tabular-nums`} />
                              )}
                            </Field>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep.id === "schedule" && (
            <WeeklyScheduleStep
              rows={rows}
              subjectName={subjectName}
              teacherName={teacherName}
              teachers={teacherChoices.filter((t) => t.active)}
              slots={slots}
              setSlots={(update) => setSlots(update)}
              slotError={(index, field) => fieldErrors[`slots.${index}.${field}`]}
              clearSlotErrors={(index) => clearFieldError(`slots.${index}.weekday`, `slots.${index}.start`, `slots.${index}.end`, `slots.${index}.enrolmentId`)}
              classMinutes={CLASS_MINUTES}
              preferences={intakeInfo?.preferences}
              studentId={isEdit ? student?.id : undefined}
              packageInfo={{
                includePackage,
                packageName,
                totalCredits: Number(totalCredits) || 0,
              }}
            />
          )}

          {currentStep.id === "review" && <ReviewStep data={reviewData} onEdit={(id) => { const i = steps.findIndex((s) => s.id === id); if (i >= 0) setStepIndex(i); }} />}

          <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-5 py-3 sm:-mx-7 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              {stepIndex > 0 && (
                <Button type="button" variant="ghost" onClick={() => { setFormError(""); setStepIndex(stepIndex - 1); }} disabled={submitting || checking}>
                  Back
                </Button>
              )}
              {!isEdit && (
                <Button type="button" variant="outline" icon={Save} onClick={saveDraft} loading={savingDraft} disabled={submitting}>
                  Save draft
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" onClick={requestClose} disabled={submitting}>
                Cancel
              </Button>
              {isLast ? (
                <Button type="submit" loading={submitting} icon={isEdit ? Save : UserPlus}>
                  {isEdit ? (legacyDraft ? "Confirm admission" : "Save changes") : "Confirm admission"}
                </Button>
              ) : (
                <Button type="submit" loading={checking}>
                  {checking ? "Checking…" : steps[stepIndex + 1]?.id === "review" ? "Review" : "Next"}
                </Button>
              )}
            </div>
          </div>
          {checking && (
            <p className="sr-only" role="status">
              Checking the schedule and package…
            </p>
          )}
          {submitting && <RefreshCw className="sr-only" aria-hidden="true" />}
        </form>
      </ModalShell>

      {quickSubjectOpen && (
        <QuickAddSubjectModal
          onClose={() => { setQuickSubjectOpen(false); setQuickSubjectRowKey(null); }}
          onSuccess={handleSubjectCreated}
        />
      )}
    </>
  );
}
