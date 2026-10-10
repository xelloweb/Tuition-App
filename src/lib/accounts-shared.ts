/**
 * Accounts (sales, expenses, profit & loss): choices and date ranges shared by
 * the page and the server. Isomorphic: no server-only imports. All dates are
 * IST calendar dates (YYYY-MM-DD); amounts are whole rupees.
 */

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Staff salaries",
  "Marketing & advertising",
  "Software & subscriptions",
  "Internet & phone",
  "Electricity & utilities",
  "Office supplies",
  "Equipment",
  "Travel",
  "Bank & payment charges",
  "Taxes & fees",
  "Professional services",
  "Other",
] as const;

export const EXPENSE_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
] as const;
export const methodLabel = (value: string) => EXPENSE_METHODS.find((m) => m.value === value)?.label ?? value;

/**
 * CASH: money received from parents and money paid out (trainer pay runs
 * marked paid, expenses) in the period. EARNED: invoices issued and trainer
 * pay for classes taught in the period, with the same expenses.
 */
export const BASES = [
  { value: "CASH", label: "Money received & paid" },
  { value: "EARNED", label: "Invoices & classes taught" },
] as const;
export type Basis = (typeof BASES)[number]["value"];

export const MAX_EXPENSE = 10_000_000;
export const MAX_RANGE_DAYS = 3 * 366;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const isYmd = (v: unknown): v is string => typeof v === "string" && YMD.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
export const istToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

/** Quick ranges; the Indian financial year runs 1 April to 31 March. */
export function quickRanges(today: string) {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const fyStartYear = m >= 4 ? y : y - 1;
  return [
    { key: "this-month", label: "This month", from: monthStart, to: today },
    { key: "last-month", label: "Last month", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { key: "this-fy", label: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`, from: `${fyStartYear}-04-01`, to: today },
    { key: "last-fy", label: `FY ${fyStartYear - 1}–${String(fyStartYear).slice(2)}`, from: `${fyStartYear - 1}-04-01`, to: `${fyStartYear}-03-31` },
  ];
}

/** "2026-10" → "Oct 2026". */
export function monthLabel(month: string) {
  const d = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export const rupees = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;
