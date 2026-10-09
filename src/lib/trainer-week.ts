/**
 * A trainer's recurring week in IST, shared by the server (trainer page and
 * schedule API) and the browser (instant overlap warnings while allocating).
 * The server's timetable checks stay the authority on save.
 */

/** Monday first, as staff read a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Free time is shown inside a 6:00 AM – 11:00 PM teaching day (IST). */
export const TEACHING_DAY_START = 6 * 60;
export const TEACHING_DAY_END = 23 * 60;

export interface TrainerWeekSlot {
  slotId: string;
  weekday: number; // IST
  startMinutes: number; // IST
  endMinutes: number; // IST
  studentId: string;
  studentName: string;
  studentCode: string;
  studentStatus: string;
  subjectName: string;
  subjectColor: string | null;
}

export interface TrainerWeekDay {
  weekday: number;
  name: string;
  classes: TrainerWeekSlot[];
  /** Gaps inside the teaching day with no class, e.g. 6:00 AM–5:00 PM. */
  free: { startMinutes: number; endMinutes: number }[];
  /** From the trainer's stated available days, when given. */
  statedAvailable: boolean | null;
}

/** "18:30" style minutes → "6:30 PM". */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function rangeLabel(startMinutes: number, endMinutes: number): string {
  return `${clockLabel(startMinutes)} – ${clockLabel(endMinutes)}`;
}

/** Half-open overlap, the same rule as the timetable: back-to-back classes are fine. */
export function minutesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** The first booked class of the week that a proposed slot would overlap, if any. */
export function findWeeklyOverlap(
  week: Pick<TrainerWeekSlot, "weekday" | "startMinutes" | "endMinutes" | "studentId">[] | TrainerWeekSlot[],
  slot: { weekday: number; startMinutes: number; endMinutes: number },
  ignoreStudentId?: string
): TrainerWeekSlot | null {
  for (const booked of week as TrainerWeekSlot[]) {
    if (ignoreStudentId && booked.studentId === ignoreStudentId) continue;
    if (booked.weekday === slot.weekday && minutesOverlap(slot.startMinutes, slot.endMinutes, booked.startMinutes, booked.endMinutes)) {
      return booked;
    }
  }
  return null;
}

/** Plain-language warning for an overlap, naming the existing class. */
export function overlapMessage(trainerName: string, booked: TrainerWeekSlot): string {
  return `${trainerName} already teaches ${booked.studentName} (${booked.subjectName}) on ${DAY_NAMES[booked.weekday]} ${rangeLabel(booked.startMinutes, booked.endMinutes)} IST. Choose a time that does not overlap; back-to-back is fine.`;
}

const DAY_ABBREVIATIONS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Stated available days ("Mon, Wed, Fri") as weekday numbers, or null when not stated. */
export function parseStatedDays(availableDays: string | null | undefined): Set<number> | null {
  if (!availableDays?.trim()) return null;
  const days = new Set<number>();
  for (const part of availableDays.toLowerCase().split(/[^a-z]+/)) {
    const day = DAY_ABBREVIATIONS[part.slice(0, 3)];
    if (day !== undefined) days.add(day);
  }
  return days.size ? days : null;
}

/** Monday-to-Sunday view: classes in time order, free gaps and stated availability. */
export function buildWeek(slots: TrainerWeekSlot[], availableDays?: string | null): TrainerWeekDay[] {
  const stated = parseStatedDays(availableDays);
  return WEEK_ORDER.map((weekday) => {
    const classes = slots.filter((s) => s.weekday === weekday).sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
    const free: TrainerWeekDay["free"] = [];
    let cursor = TEACHING_DAY_START;
    for (const c of classes) {
      if (c.startMinutes > cursor) free.push({ startMinutes: cursor, endMinutes: Math.min(c.startMinutes, TEACHING_DAY_END) });
      cursor = Math.max(cursor, c.endMinutes);
    }
    if (cursor < TEACHING_DAY_END) free.push({ startMinutes: cursor, endMinutes: TEACHING_DAY_END });
    return {
      weekday,
      name: DAY_NAMES[weekday],
      classes,
      free: free.filter((f) => f.endMinutes > f.startMinutes),
      statedAvailable: stated ? stated.has(weekday) : null,
    };
  });
}
