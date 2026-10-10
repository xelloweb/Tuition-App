/**
 * Preferred class days: the days of the week that usually suit a student, for
 * any subject. A preference only: staff see it while assigning trainers and
 * building the weekly timetable; it never books a class, reserves credits or
 * allocates a subject. Isomorphic: no server-only imports.
 */

/** Monday first, as parents read a week. Values match the timetable (0 = Sunday). */
export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
export const weekdayName = (value: number) => WEEKDAYS.find((d) => d.value === value)?.label ?? "Day";

/** Monday first, without repeats. */
export const sortDays = (days: number[]) => WEEKDAYS.map((d) => d.value).filter((v) => days.includes(v));

/** "Monday, Wednesday, Saturday". */
export const dayList = (days: number[]) => sortDays(days).map(weekdayName).join(", ");

/**
 * Checks a list of days sent by a form (numbers, or digit strings).
 * Returns the days Monday first, or null when anything is not a day.
 */
export function cleanDays(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 14) return null;
  const days: number[] = [];
  for (const item of raw) {
    const day = typeof item === "string" && /^\d$/.test(item) ? Number(item) : item;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
    days.push(day);
  }
  return sortDays(days);
}

/** Stored on the student as JSON ("[1,3,5]"); null when none. */
export const storeDays = (days: number[]) => (days.length ? JSON.stringify(sortDays(days)) : null);

/** Reads the stored value; anything unreadable counts as no days. */
export function readDays(stored: string | null | undefined): number[] {
  if (!stored) return [];
  try {
    return cleanDays(JSON.parse(stored)) ?? [];
  } catch {
    return [];
  }
}
