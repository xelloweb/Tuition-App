/**
 * Every date and time in Xello is India Standard Time, whatever time zone the
 * phone is set to (many trainers and parents are in the Gulf). IST is a fixed
 * UTC+05:30 with no daylight saving, so the shift is done by hand instead of
 * relying on the phone's time-zone data.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A Date whose UTC fields read as the IST wall-clock time. */
function istFields(value: string | number | Date): Date {
  return new Date(new Date(value).getTime() + IST_OFFSET_MS);
}

/** "5:30 PM" in IST. */
export function formatIstTime(value: string | number | Date): string {
  const d = istFields(value);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

/** "9 Oct 2026" in IST, or "9 Oct" without the year. */
export function formatIstDate(value: string | number | Date, withYear = true): string {
  const d = istFields(value);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${date} ${d.getUTCFullYear()}` : date;
}

/** Today's weekday in IST (0 = Sunday … 6 = Saturday). */
export function istWeekdayToday(): number {
  return istFields(Date.now()).getUTCDay();
}

/** Today's date in IST as YYYY-MM-DD (the class date the website uses). */
export function istTodayDate(): string {
  const d = istFields(Date.now());
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
