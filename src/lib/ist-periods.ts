import { BUSINESS_TIME_ZONE } from "./constants";
import { addDaysToLocalDate, localDateInZone, zonedTimeToUtc } from "./zoned-time";

/**
 * "Today" and "this month" as UTC ranges in IST, the business time zone, so a
 * server running on UTC still counts days from IST midnight.
 */
export function istPeriods(now = new Date()) {
  const today = localDateInZone(now, BUSINESS_TIME_ZONE);
  const [year, month] = today.split("-").map(Number);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const firstOfNextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    today: {
      gte: zonedTimeToUtc(today, 0, BUSINESS_TIME_ZONE),
      lt: zonedTimeToUtc(addDaysToLocalDate(today, 1), 0, BUSINESS_TIME_ZONE),
    },
    month: {
      gte: zonedTimeToUtc(firstOfMonth, 0, BUSINESS_TIME_ZONE),
      lt: zonedTimeToUtc(firstOfNextMonth, 0, BUSINESS_TIME_ZONE),
    },
  };
}
