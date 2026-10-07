/**
 * Shared trainer-profile vocabulary (forms, cards, import and API validation).
 */

export const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const DAY_PATTERNS: [DayKey, RegExp][] = [
  ["Mon", /\bmon(day)?\b/],
  ["Tue", /\btue(s|sday)?\b/],
  ["Wed", /\bwed(nesday)?\b/],
  ["Thu", /\bthu(r|rs|rsday)?\b/],
  ["Fri", /\bfri(day)?\b/],
  ["Sat", /\bsat(urday)?\b/],
  ["Sun", /\bsun(day)?\b/],
];

/** "Monday, Tuesday" / ["Mon","Tue"] / "every day" → ordered day keys. */
export function readDays(value: unknown): DayKey[] {
  const text = (Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "").toLowerCase();
  if (/\b(every\s*day|everyday|daily|all\s*days)\b/.test(text)) return [...DAY_KEYS];
  return DAY_PATTERNS.filter(([, re]) => re.test(text)).map(([key]) => key);
}

/** ["Mon","Tue","Wed","Thu","Fri"] → "Mon–Fri"; all seven → "Every day". */
export function formatDays(days: readonly string[]): string {
  const idx = DAY_KEYS.map((d, i) => (days.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 7) return "Every day";
  const parts: string[] = [];
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    parts.push(j - i >= 2 ? `${DAY_KEYS[idx[i]]}–${DAY_KEYS[idx[j]]}` : idx.slice(i, j + 1).map((k) => DAY_KEYS[k]).join(", "));
    i = j + 1;
  }
  return parts.join(", ");
}

export const SYLLABUS_OPTIONS = [
  "Kerala State English Medium",
  "Kerala State Malayalam Medium",
  "CBSE",
  "ICSE",
  "IGCSE",
  "NIOS",
];

export const DEVICE_OPTIONS = ["Laptop", "Tab", "Mobile Phone", "Other"];
