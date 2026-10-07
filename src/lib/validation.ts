/**
 * Isomorphic validation helpers shared by the forms (instant feedback) and the
 * API routes (authoritative checks). Nothing here may import server-only code.
 */
import { PHONE_RULES } from "./constants";

export type FieldErrorMap = Record<string, string>;

/** Converts undefined / null / blank strings to null and trims everything else. */
export function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export interface PhoneCheck {
  ok: boolean;
  /** Cleaned value for storage (spacing preserved, stray characters removed). */
  display: string;
  /** "+" followed by digits only; used for matching numbers written differently. */
  canonical: string;
  error?: string;
}

/**
 * Validates an international WhatsApp number such as "+971 50 123 4567" or
 * "+91 98470 12345". Requires a leading "+" and country code.
 */
export function checkInternationalPhone(raw: string): PhoneCheck {
  const display = raw.replace(/[^\d+\s()-]/g, "").replace(/\s+/g, " ").trim();
  const digits = display.replace(/\D/g, "");
  const canonical = `+${digits}`;

  if (!display.startsWith("+")) {
    return {
      ok: false,
      display,
      canonical,
      error: "Start with + and the country code, e.g. +91 98470 12345 or +971 50 123 4567.",
    };
  }
  if (digits.length < 8 || digits.length > 15) {
    return {
      ok: false,
      display,
      canonical,
      error: "Enter the full number including country code (8–15 digits).",
    };
  }

  const code = ["971", "966", "974", "968", "965", "973", "91"].find((c) => digits.startsWith(c));
  if (code) {
    const rule = PHONE_RULES[code];
    const subscriberDigits = digits.length - code.length;
    if (subscriberDigits < rule.min || subscriberDigits > rule.max) {
      const expected = rule.min === rule.max ? `${rule.min}` : `${rule.min}–${rule.max}`;
      return {
        ok: false,
        display,
        canonical,
        error: `${rule.country} numbers need ${expected} digits after +${code}.`,
      };
    }
  }
  return { ok: true, display, canonical };
}

/** Digits including the country code; a bare (or 0-prefixed) 10-digit Indian mobile counts as +91. */
export function phoneKey(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  return digits;
}

/** Same number however it is written ("9876543210", "+91 98765 43210"). Used to flag duplicates, never to merge. */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return phoneKey(a) === phoneKey(b);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Parses an ISO date or yyyy-mm-dd string. Returns null for blank input. */
export function parseDateInput(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) return "invalid";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

/**
 * Collects per-field errors so a form can show every problem at once.
 */
export class FieldCollector {
  readonly errors: FieldErrorMap = {};

  get hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  add(field: string, message: string) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  requiredText(field: string, value: unknown, label: string, max = 120): string {
    if (value !== undefined && value !== null && typeof value !== "string") {
      this.add(field, `${label} must be text.`);
      return "";
    }
    const text = normalizeOptionalText(value);
    if (!text) {
      this.add(field, `${label} is required.`);
      return "";
    }
    if (text.length > max) this.add(field, `${label} must be ${max} characters or fewer.`);
    return text;
  }

  optionalText(field: string, value: unknown, label: string, max = 1000): string | null {
    if (value !== undefined && value !== null && typeof value !== "string") {
      this.add(field, `${label} must be text.`);
      return null;
    }
    const text = normalizeOptionalText(value);
    if (text && text.length > max) this.add(field, `${label} must be ${max} characters or fewer.`);
    return text;
  }

  email(field: string, value: unknown, label: string, required: boolean): string | null {
    const text = required
      ? this.requiredText(field, value, label, 254)
      : this.optionalText(field, value, label, 254);
    if (!text) return null;
    const lower = text.toLowerCase();
    if (!isValidEmail(lower)) {
      this.add(field, `Enter a valid email address, e.g. name@example.com.`);
    }
    return lower;
  }

  phone(field: string, value: unknown, label: string): string {
    const text = this.requiredText(field, value, label, 30);
    if (!text) return "";
    const check = checkInternationalPhone(text);
    if (!check.ok) this.add(field, check.error || `${label} is not a valid phone number.`);
    return check.display;
  }

  oneOf<T extends string>(
    field: string,
    value: unknown,
    allowed: readonly T[],
    label: string,
    fallback?: T
  ): T {
    const text = normalizeOptionalText(value);
    if (!text) {
      if (fallback !== undefined) return fallback;
      this.add(field, `${label} is required.`);
      return allowed[0];
    }
    if (!allowed.includes(text as T)) {
      this.add(field, `Choose a valid ${label.toLowerCase()}.`);
      return allowed[0];
    }
    return text as T;
  }

  timeZone(field: string, value: unknown, fallback: string): string {
    const text = normalizeOptionalText(value);
    if (!text) return fallback;
    if (!isValidTimeZone(text)) {
      this.add(field, "Choose a valid time zone.");
      return fallback;
    }
    return text;
  }

  integer(
    field: string,
    value: unknown,
    label: string,
    { min, max, fallback }: { min: number; max: number; fallback?: number }
  ): number {
    if (value === undefined || value === null || value === "") {
      if (fallback !== undefined) return fallback;
      this.add(field, `${label} is required.`);
      return min;
    }
    const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      this.add(field, `${label} must be a whole number.`);
      return min;
    }
    if (num < min || num > max) {
      this.add(field, `${label} must be between ${min} and ${max}.`);
    }
    return num;
  }

  date(field: string, value: unknown, label: string, required: boolean): Date | null {
    const parsed = parseDateInput(value);
    if (parsed === "invalid") {
      this.add(field, `${label} is not a valid date.`);
      return null;
    }
    if (!parsed && required) this.add(field, `${label} is required.`);
    return parsed;
  }

  id(field: string, value: unknown, label: string): string {
    if (typeof value !== "string" || !value.trim() || value.length > 64) {
      this.add(field, `Choose a ${label.toLowerCase()}.`);
      return "";
    }
    return value.trim();
  }
}
