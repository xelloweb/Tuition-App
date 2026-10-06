/**
 * Shared option lists used by forms (client) and validation (server) so both
 * sides agree on allowed values.
 */

export interface CountryOption {
  value: string;
  label: string;
  flag: string;
  dialCode: string;
  timeZone: string;
}

export const COUNTRIES: CountryOption[] = [
  { value: "UAE", label: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971", timeZone: "Asia/Dubai" },
  { value: "Saudi Arabia", label: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966", timeZone: "Asia/Riyadh" },
  { value: "Qatar", label: "Qatar", flag: "🇶🇦", dialCode: "+974", timeZone: "Asia/Qatar" },
  { value: "Oman", label: "Oman", flag: "🇴🇲", dialCode: "+968", timeZone: "Asia/Muscat" },
  { value: "Kuwait", label: "Kuwait", flag: "🇰🇼", dialCode: "+965", timeZone: "Asia/Kuwait" },
  { value: "Bahrain", label: "Bahrain", flag: "🇧🇭", dialCode: "+973", timeZone: "Asia/Bahrain" },
  { value: "India", label: "India (Kerala)", flag: "🇮🇳", dialCode: "+91", timeZone: "Asia/Kolkata" },
];

export const COUNTRY_VALUES = COUNTRIES.map((c) => c.value);

export function findCountry(value: string | null | undefined): CountryOption | undefined {
  return COUNTRIES.find((c) => c.value === value);
}

export const BOARD_OPTIONS = [
  "CBSE",
  "ICSE",
  "Kerala State Board",
  "Cambridge IGCSE",
  "Edexcel",
  "IB (International Baccalaureate)",
  "State Board (Other)",
];

export const MEDIUM_OPTIONS = ["English", "Malayalam", "Hindi"];

export const STUDENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "WITHDRAWN", label: "Withdrawn (archived)" },
];

export const STUDENT_STATUS_VALUES = STUDENT_STATUSES.map((s) => s.value);

/** Mobile/WhatsApp subscriber-number lengths (digits after the country code). */
export const PHONE_RULES: Record<string, { country: string; min: number; max: number }> = {
  "91": { country: "India", min: 10, max: 10 },
  "971": { country: "UAE", min: 8, max: 9 },
  "966": { country: "Saudi Arabia", min: 8, max: 9 },
  "974": { country: "Qatar", min: 8, max: 8 },
  "968": { country: "Oman", min: 8, max: 8 },
  "965": { country: "Kuwait", min: 8, max: 8 },
  "973": { country: "Bahrain", min: 8, max: 8 },
};

/** Business time zone used for due dates and "today" boundaries. */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
