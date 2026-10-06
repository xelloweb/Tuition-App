/**
 * Wall-clock ↔ UTC conversion for IANA time zones using only Intl (works in
 * Node and the browser). Recurring timetable slots are stored as weekday +
 * local minutes + zone; only dated class occurrences are converted to UTC.
 */

export const WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" },
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayShort = get("weekday");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.findIndex((w) => w.short === weekdayShort),
  };
}

/** Offset of the zone from UTC (minutes) at the given instant, e.g. +240 for Asia/Dubai. */
export function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const p = zonedParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** UTC instant of a local wall-clock time (date "YYYY-MM-DD" + minutes after midnight) in a zone. */
export function zonedTimeToUtc(localDate: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, minutes);
  let utc = wallAsUtc - zoneOffsetMinutes(wallAsUtc, timeZone) * 60000;
  // Second pass corrects for an offset change (DST) between the two instants.
  const corrected = wallAsUtc - zoneOffsetMinutes(utc, timeZone) * 60000;
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

/** Local calendar date ("YYYY-MM-DD") of an instant in a zone. */
export function localDateInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysToLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOfLocalDate(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "20:30" -> 1230. Returns null for anything that is not a valid 24h HH:MM time. */
export function parseTimeOfDay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 1230 -> "20:30" (value for <input type="time">). */
export function minutesToTimeInput(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 1230 -> "8:30 PM". */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function shortZoneLabel(timeZone: string): string {
  const labels: Record<string, string> = {
    "Asia/Kolkata": "IST",
    "Asia/Dubai": "GST",
    "Asia/Muscat": "GST",
    "Asia/Riyadh": "AST",
    "Asia/Qatar": "AST",
    "Asia/Kuwait": "AST",
    "Asia/Bahrain": "AST",
  };
  return labels[timeZone] ?? timeZone;
}

/** Weekday + time of an instant as seen in another zone (handles day changes). */
export function describeInZone(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const minutes = p.hour * 60 + p.minute;
  return {
    weekday: p.weekday,
    weekdayShort: WEEKDAYS[p.weekday]?.short ?? "",
    minutes,
    time: formatMinutes(minutes),
    localDate: localDateInZone(date, timeZone),
  };
}

/**
 * Converts a recurring local slot to another zone using a concrete reference
 * occurrence, so the weekday shift (e.g. Sat 11 PM GST → Sun 12:30 AM IST) is right.
 */
export function convertSlotForDisplay(
  slot: { weekday: number; startMinutes: number; endMinutes: number; timeZone: string },
  targetZone: string,
  reference: Date = new Date()
) {
  const today = localDateInZone(reference, slot.timeZone);
  const delta = (slot.weekday - weekdayOfLocalDate(today) + 7) % 7;
  const date = addDaysToLocalDate(today, delta);
  const start = describeInZone(zonedTimeToUtc(date, slot.startMinutes, slot.timeZone), targetZone);
  const end = describeInZone(zonedTimeToUtc(date, slot.endMinutes, slot.timeZone), targetZone);
  const diff = (start.weekday - slot.weekday + 7) % 7;
  return {
    weekday: start.weekday,
    weekdayShort: start.weekdayShort,
    start: start.time,
    end: end.time,
    /** -1 previous day, 0 same day, +1 next day relative to the slot's own weekday. */
    dayShift: diff === 6 ? -1 : diff,
  };
}
