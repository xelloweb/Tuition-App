export interface TimeZoneOption {
  value: string;
  label: string;
  offset: string;
  region: string;
}

export const TIMEZONES: TimeZoneOption[] = [
  {
    value: "Asia/Kolkata",
    label: "India Standard Time (IST)",
    offset: "+05:30",
    region: "Kerala / India",
  },
  {
    value: "Asia/Dubai",
    label: "Gulf Standard Time (GST)",
    offset: "+04:00",
    region: "UAE / Oman",
  },
  {
    value: "Asia/Riyadh",
    label: "Arabia Standard Time (AST)",
    offset: "+03:00",
    region: "Saudi Arabia / Kuwait / Bahrain / Qatar",
  },
  {
    value: "Asia/Qatar",
    label: "Qatar Time (AST)",
    offset: "+03:00",
    region: "Qatar",
  },
  {
    value: "Asia/Muscat",
    label: "Gulf Standard Time (Oman)",
    offset: "+04:00",
    region: "Oman",
  },
  {
    value: "Asia/Kuwait",
    label: "Arabia Standard Time (Kuwait)",
    offset: "+03:00",
    region: "Kuwait",
  },
];

export function formatInTimeZone(
  date: Date | string,
  timeZone = "Asia/Kolkata",
  formatString?: string
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";

  try {
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(d);
  } catch (err) {
    return d.toLocaleString();
  }
}

export function formatTimeOnly(
  date: Date | string,
  timeZone = "Asia/Kolkata"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch (e) {
    return "";
  }
}

export function formatDateOnly(
  date: Date | string,
  timeZone = "Asia/Kolkata"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch (e) {
    return "";
  }
}
