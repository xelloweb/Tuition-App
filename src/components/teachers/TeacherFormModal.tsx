"use client";

import { useMemo, useRef, useState } from "react";
import { X, GraduationCap, Sparkles, RefreshCw, DollarSign, Globe, BookOpen, Lock } from "lucide-react";
import { TIMEZONES } from "@/lib/timezones";
import { TEACHER_PRESET_GRADES } from "@/lib/grades";
import { COUNTRIES, findCountry } from "@/lib/constants";
import { RATE_LIMITS, RATE_TIERS, RateTierKey, defaultTierRate, parseGradeRates } from "@/lib/rates";
import { checkInternationalPhone, isValidEmail } from "@/lib/validation";
import { ClientApiError, apiRequest, errorMessage, newIdempotencyKey } from "@/lib/client-api";
import { ModalShell } from "@/components/ui/ModalShell";
import { FieldError, FormErrorSummary, focusField, inputClass } from "@/components/ui/FormFeedback";

const PRESET_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Computer Science",
  "Social Science",
  "Hindi",
  "Malayalam",
  "Arabic",
];

const FIELD_LABELS: Record<string, string> = {
  name: "Full name",
  email: "Email",
  phone: "Phone / WhatsApp",
  country: "Country",
  timeZone: "Time zone",
  subjects: "Subjects",
  grades: "Grades",
  defaultRate: "Base rate",
  ...Object.fromEntries(RATE_TIERS.map((t) => [`gradeRates.${t.key}`, `${t.label} rate`])),
};

export interface TeacherFormRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  subjects: string;
  grades: string;
  country: string;
  timeZone: string;
  active: boolean;
  defaultRate: number | null;
  gradeRates: string | null;
}

interface TeacherFormModalProps {
  mode: "create" | "edit";
  teacher?: TeacherFormRecord;
  availableSubjects?: { id: string; name: string }[];
  canSetRates: boolean;
  onClose: () => void;
  onSuccess: (teacher: TeacherFormRecord, info: { message: string; warning?: string }) => void;
}

const splitList = (value?: string | null) =>
  (value || "").split(",").map((s) => s.trim()).filter(Boolean);

const inputBase =
  "w-full rounded-xl border bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden";

export function TeacherFormModal({
  mode,
  teacher,
  availableSubjects = [],
  canSetRates,
  onClose,
  onSuccess,
}: TeacherFormModalProps) {
  const isEdit = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  const [name, setName] = useState(teacher?.name ?? "");
  const [email, setEmail] = useState(teacher?.email ?? "");
  const [phone, setPhone] = useState(teacher?.phone ?? "+91 ");
  const [country, setCountry] = useState(teacher?.country ?? "India");
  const [timeZone, setTimeZone] = useState(teacher?.timeZone ?? "Asia/Kolkata");
  const [active, setActive] = useState(teacher?.active ?? true);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    teacher ? splitList(teacher.subjects) : ["Mathematics"]
  );
  const [customSubject, setCustomSubject] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(
    teacher
      ? splitList(teacher.grades)
      : ["High School (9th–10th)", "Plus One (+1 / 11th)", "Plus Two (+2 / 12th)"]
  );

  const initialBase = teacher?.defaultRate ?? 550;
  const initialOverrides = parseGradeRates(teacher?.gradeRates);
  const [baseRate, setBaseRate] = useState(String(initialBase));
  const [tierRates, setTierRates] = useState<Record<RateTierKey, string>>(() => {
    const rates = {} as Record<RateTierKey, string>;
    for (const tier of RATE_TIERS) {
      rates[tier.key] = String(initialOverrides[tier.key] ?? defaultTierRate(initialBase, tier.key));
    }
    return rates;
  });
  // Tiers the user typed into stop following the base rate.
  const [touchedTiers, setTouchedTiers] = useState<Set<RateTierKey>>(
    () => new Set(Object.keys(initialOverrides) as RateTierKey[])
  );

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const showRates = canSetRates;
  const ratesHiddenNote = isEdit
    ? "Pay rates are managed by the owner and are not shown for your role."
    : "Pay rates are set by the owner after the profile is created (default base rate ₹500/hr).";

  const subjectChoices = useMemo(
    () => Array.from(new Set([...availableSubjects.map((s) => s.name), ...PRESET_SUBJECTS, ...selectedSubjects])),
    [availableSubjects, selectedSubjects]
  );
  const gradeChoices = useMemo(
    () => Array.from(new Set([...TEACHER_PRESET_GRADES, ...selectedGrades])),
    [selectedGrades]
  );

  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleCountryChange = (value: string) => {
    setCountry(value);
    const option = findCountry(value);
    if (!option) return;
    setTimeZone(option.timeZone);
    // Only swap the dialling prefix if no real number has been typed yet.
    const digits = phone.replace(/\D/g, "");
    const isPrefixOnly = !digits || COUNTRIES.some((c) => c.dialCode.replace("+", "") === digits);
    if (isPrefixOnly) setPhone(`${option.dialCode} `);
  };

  const handleBaseRateChange = (value: string) => {
    setBaseRate(value);
    clearFieldError("defaultRate");
    const base = Number(value);
    if (!Number.isFinite(base) || base <= 0) return;
    setTierRates((prev) => {
      const next = { ...prev };
      for (const tier of RATE_TIERS) {
        if (!touchedTiers.has(tier.key)) next[tier.key] = String(defaultTierRate(base, tier.key));
      }
      return next;
    });
  };

  const handleTierChange = (key: RateTierKey, value: string) => {
    setTierRates((prev) => ({ ...prev, [key]: value }));
    setTouchedTiers((prev) => new Set(prev).add(key));
    clearFieldError(`gradeRates.${key}`);
  };

  const toggle = (list: string[], setList: (v: string[]) => void, value: string, field: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    clearFieldError(field);
  };

  const addCustomSubject = () => {
    const value = customSubject.trim();
    if (!value) return;
    if (!selectedSubjects.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSelectedSubjects([...selectedSubjects, value]);
    }
    setCustomSubject("");
    clearFieldError("subjects");
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Full name is required.";
    if (!email.trim()) errors.email = "Email address is required.";
    else if (!isValidEmail(email.trim().toLowerCase())) errors.email = "Enter a valid email address, e.g. name@example.com.";
    const phoneCheck = checkInternationalPhone(phone);
    if (!phone.replace(/\D/g, "") || !phoneCheck.ok) {
      errors.phone = phoneCheck.error || "Enter the phone / WhatsApp number with country code.";
    }
    if (selectedSubjects.length === 0) errors.subjects = "Select or add at least one subject.";
    if (selectedGrades.length === 0) errors.grades = "Select at least one supported grade.";
    if (showRates) {
      const inRange = (v: string) => {
        const n = Number(v);
        return v.trim() !== "" && Number.isInteger(n) && n >= RATE_LIMITS.min && n <= RATE_LIMITS.max;
      };
      if (!inRange(baseRate)) errors.defaultRate = `Enter a whole number between ${RATE_LIMITS.min} and ${RATE_LIMITS.max}.`;
      for (const tier of RATE_TIERS) {
        if (!inRange(tierRates[tier.key])) {
          errors[`gradeRates.${tier.key}`] = `Enter a whole number between ${RATE_LIMITS.min} and ${RATE_LIMITS.max}.`;
        }
      }
    }
    return errors;
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

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      subjects: selectedSubjects,
      grades: selectedGrades,
      country,
      timeZone,
    };
    if (isEdit) payload.active = active;
    if (showRates) {
      const base = Number(baseRate);
      const overrides: Partial<Record<RateTierKey, number>> = {};
      for (const tier of RATE_TIERS) {
        const value = Number(tierRates[tier.key]);
        if (value !== defaultTierRate(base, tier.key)) overrides[tier.key] = value;
      }
      payload.defaultRate = base;
      payload.gradeRates = overrides;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});
    try {
      const data = await apiRequest<{ teacher: TeacherFormRecord; replayed?: boolean; warning?: string }>(
        isEdit ? `/api/teachers/${teacher!.id}` : "/api/teachers",
        { method: isEdit ? "PATCH" : "POST", body: payload, idempotencyKey: isEdit ? undefined : idempotencyKey }
      );
      onSuccess(data.teacher, {
        message: isEdit
          ? `Trainer profile "${data.teacher.name}" updated.`
          : `Trainer "${data.teacher.name}" added${data.replayed ? " (already saved — no duplicate created)" : ""}.`,
        warning: data.warning,
      });
    } catch (err) {
      const apiErr = err instanceof ClientApiError ? err : null;
      setFieldErrors(apiErr?.fieldErrors ?? {});
      setFormError(errorMessage(err, "Could not save the trainer profile."));
      const firstField = Object.keys(apiErr?.fieldErrors ?? {})[0];
      if (firstField) focusField(formRef.current, firstField);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const err = (field: string) => fieldErrors[field];
  const titleId = isEdit ? "edit-teacher-title" : "add-teacher-title";

  return (
    <ModalShell labelledBy={titleId} onClose={onClose} closeDisabled={submitting}>
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-teal-500/10 border border-teal-500/20 p-2.5 text-teal-300">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-white">
              {isEdit ? "Edit Trainer Profile" : "Register New Trainer / Tutor"}
            </h2>
            <p className="text-xs text-slate-400">
              {isEdit
                ? "Update contact details, subjects, supported grades and status."
                : "Creates the trainer's operational profile only. No login account or invitation is sent."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-touch-target flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        <FormErrorSummary
          message={formError}
          fieldErrors={fieldErrors}
          labels={FIELD_LABELS}
          onFocusField={(f) => focusField(formRef.current, f)}
        />

        {isEdit && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
            <div>
              <span className="font-bold text-white block">Trainer status</span>
              <span className="text-[11px] text-slate-400">
                {active ? "Active — can be assigned to students and sessions" : "Inactive — hidden from new assignments; history kept"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors min-h-[38px] ${
                active
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800 border border-slate-700 text-slate-400"
              }`}
            >
              {active ? "● ACTIVE" : "○ INACTIVE"}
            </button>
          </div>
        )}

        {/* Section 1: Profile & contact */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            1. Trainer Profile & Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="teacher-name" className="text-[11px] font-semibold text-slate-300 block mb-1">
                Full Name & Title <span className="text-rose-400">*</span>
              </label>
              <input
                id="teacher-name"
                data-field="name"
                type="text"
                autoComplete="off"
                placeholder="e.g. Anand K., M.Sc."
                value={name}
                aria-invalid={!!err("name")}
                aria-describedby={err("name") ? "teacher-name-error" : undefined}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                className={inputClass(inputBase, !!err("name"))}
              />
              <FieldError id="teacher-name-error" message={err("name")} />
            </div>

            <div>
              <label htmlFor="teacher-email" className="text-[11px] font-semibold text-slate-300 block mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                id="teacher-email"
                data-field="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="e.g. anand@example.com"
                value={email}
                aria-invalid={!!err("email")}
                aria-describedby={err("email") ? "teacher-email-error" : undefined}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                className={inputClass(inputBase, !!err("email"))}
              />
              <FieldError id="teacher-email-error" message={err("email")} />
            </div>

            <div>
              <label htmlFor="teacher-phone" className="text-[11px] font-semibold text-slate-300 block mb-1">
                Phone / WhatsApp (with country code) <span className="text-rose-400">*</span>
              </label>
              <input
                id="teacher-phone"
                data-field="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+91 98470 12345"
                value={phone}
                aria-invalid={!!err("phone")}
                aria-describedby={err("phone") ? "teacher-phone-error" : undefined}
                onChange={(e) => { setPhone(e.target.value); clearFieldError("phone"); }}
                className={`${inputClass(inputBase, !!err("phone"))} font-mono`}
              />
              <FieldError id="teacher-phone-error" message={err("phone")} />
            </div>

            <div>
              <label htmlFor="teacher-country" className="text-[11px] font-semibold text-slate-300 block mb-1">
                Country of Residence
              </label>
              <select
                id="teacher-country"
                data-field="country"
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={inputClass(inputBase, !!err("country"))}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-slate-900">
                    {c.flag} {c.label}
                  </option>
                ))}
              </select>
              <FieldError message={err("country")} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="teacher-tz" className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3 text-teal-400" />
                Time Zone for Scheduling
              </label>
              <select
                id="teacher-tz"
                data-field="timeZone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className={inputClass(inputBase, !!err("timeZone"))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-slate-900">
                    {tz.label} ({tz.offset}) - {tz.region}
                  </option>
                ))}
              </select>
              <FieldError message={err("timeZone")} />
            </div>
          </div>
        </div>

        {/* Section 2: Subjects */}
        <div className="space-y-3 pt-3 border-t border-slate-800" data-field="subjects" tabIndex={-1}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-teal-400" />
            2. Subjects & Specializations <span className="text-rose-400">*</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {subjectChoices.map((sub) => {
              const isSelected = selectedSubjects.includes(sub);
              return (
                <button
                  type="button"
                  key={sub}
                  aria-pressed={isSelected}
                  onClick={() => toggle(selectedSubjects, setSelectedSubjects, sub, "subjects")}
                  className={`rounded-xl px-3 py-1.5 min-h-[36px] text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs"
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {sub} {isSelected && "✓"}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              aria-label="Add another subject"
              placeholder="Add other subject or specialty..."
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSubject();
                }
              }}
              className={`flex-1 min-w-0 ${inputClass(inputBase, false)}`}
            />
            <button
              type="button"
              onClick={addCustomSubject}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
            >
              + Add
            </button>
          </div>
          <FieldError message={err("subjects")} />
        </div>

        {/* Section 3: Grades */}
        <div className="space-y-3 pt-3 border-t border-slate-800" data-field="grades" tabIndex={-1}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
            3. Supported Grades & Classes <span className="text-rose-400">*</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {gradeChoices.map((gr) => {
              const isSelected = selectedGrades.includes(gr);
              return (
                <button
                  type="button"
                  key={gr}
                  aria-pressed={isSelected}
                  onClick={() => toggle(selectedGrades, setSelectedGrades, gr, "grades")}
                  className={`rounded-xl px-3 py-1.5 min-h-[36px] text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs"
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {gr} {isSelected && "✓"}
                </button>
              );
            })}
          </div>
          <FieldError message={err("grades")} />
        </div>

        {/* Section 4: Pay rates (owner only) */}
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-teal-400" />
              4. Hourly Payout Rates (INR / Hour)
            </h3>
            {showRates && <span className="text-[10px] text-slate-500 text-right">Snapshot taken when attendance is marked</span>}
          </div>

          {showRates ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="teacher-base-rate" className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Default Base Rate (₹ / hr) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      id="teacher-base-rate"
                      data-field="defaultRate"
                      type="number"
                      inputMode="numeric"
                      min={RATE_LIMITS.min}
                      step="50"
                      value={baseRate}
                      aria-invalid={!!err("defaultRate")}
                      onChange={(e) => handleBaseRateChange(e.target.value)}
                      className={`${inputClass(inputBase, !!err("defaultRate"))} pl-7 font-bold`}
                    />
                  </div>
                  <FieldError message={err("defaultRate")} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex justify-between items-center gap-2 text-[11px] font-bold text-white">
                  <span>Standard-Wise Hourly Pay Rates</span>
                  <span className="text-[10px] text-teal-400 font-normal text-right">Untouched tiers follow the base rate</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {RATE_TIERS.map((tier) => (
                    <div key={tier.key} className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
                      <label htmlFor={`tier-${tier.key}`} className="text-[10px] text-slate-400 block font-medium">
                        {tier.label}
                      </label>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-bold text-slate-500">₹</span>
                        <input
                          id={`tier-${tier.key}`}
                          data-field={`gradeRates.${tier.key}`}
                          type="number"
                          inputMode="numeric"
                          value={tierRates[tier.key]}
                          aria-invalid={!!err(`gradeRates.${tier.key}`)}
                          onChange={(e) => handleTierChange(tier.key, e.target.value)}
                          className="w-full min-h-[32px] text-xs font-bold text-white bg-transparent focus:outline-hidden focus-visible:ring-1 focus-visible:ring-teal-400 rounded"
                        />
                      </div>
                      <FieldError message={err(`gradeRates.${tier.key}`)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
              <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              {ratesHiddenNote}
            </div>
          )}
        </div>

        {/* Actions: sticky so they stay reachable on long forms / small screens */}
        <div className="sticky bottom-0 -mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[#0c1220]/95 backdrop-blur border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-5 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-teal-500/20 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-50 transition-all active:scale-95"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                {isEdit ? "Save Changes" : "Save Trainer Profile"}
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
