/**
 * Single navigation definition for the desktop sidebar, the mobile bottom bar
 * and the mobile "More" menu, so all three always agree. Visibility here is
 * only presentation: every page and API route enforces access on the server.
 */
import {
  AlertCircle,
  BarChart3,
  Calculator,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  FileText,
  GraduationCap,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LucideIcon,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

export type NavRole = "OWNER" | "COORDINATOR" | "ACCOUNTS" | "TEACHER";

interface NavItemDef {
  href: string;
  label: string;
  /** Role-specific wording, e.g. a trainer sees "My students". */
  labelFor?: Partial<Record<NavRole, string>>;
  description: string;
  icon: LucideIcon;
  roles: NavRole[];
}

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: NavRole[] = ["OWNER", "COORDINATOR", "ACCOUNTS", "TEACHER"];

const GROUPS: { label: string; items: NavItemDef[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", labelFor: { TEACHER: "My classes" }, description: "Today's work and what needs attention", icon: LayoutDashboard, roles: ALL },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/students", label: "Students", labelFor: { TEACHER: "My students" }, description: "Profiles, subjects, packages and admissions", icon: Users, roles: ALL },
      { href: "/admissions", label: "Admissions", description: "Parent form link and parent submissions", icon: Inbox, roles: ["OWNER", "COORDINATOR"] },
      { href: "/teachers", label: "Trainers", labelFor: { TEACHER: "My trainer profile" }, description: "Trainer profiles, subjects and pay rates", icon: GraduationCap, roles: ALL },
      { href: "/timetable", label: "Timetable", description: "Classes by day and week (IST)", icon: CalendarDays, roles: ["OWNER", "COORDINATOR", "TEACHER"] },
      { href: "/attendance", label: "Attendance", description: "Pending and submitted attendance", icon: CheckCircle2, roles: ["OWNER", "COORDINATOR", "TEACHER"] },
      { href: "/packages", label: "Packages & credits", description: "Class balances and subject allocations", icon: Layers, roles: ["OWNER", "COORDINATOR"] },
      { href: "/progress", label: "Progress notes", description: "Progress notes and assessments", icon: FileText, roles: ["OWNER", "COORDINATOR", "TEACHER"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/billing", label: "Invoices & payments", description: "Invoices, payments and verification", icon: Receipt, roles: ["OWNER", "ACCOUNTS"] },
      { href: "/dues", label: "Dues & follow-ups", description: "Outstanding and overdue balances", icon: AlertCircle, roles: ["OWNER", "ACCOUNTS", "COORDINATOR"] },
      { href: "/payouts", label: "Trainer payouts", labelFor: { TEACHER: "My earnings" }, description: "Earnings and payout runs", icon: DollarSign, roles: ["OWNER", "ACCOUNTS", "TEACHER"] },
      { href: "/accounts", label: "Accounts & P&L", description: "Sales, expenses and profit & loss", icon: Calculator, roles: ["OWNER", "ACCOUNTS"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/reports", label: "Reports & exports", description: "CSV exports for a date range", icon: BarChart3, roles: ["OWNER", "COORDINATOR", "ACCOUNTS"] },
      { href: "/users", label: "Users & logins", description: "Staff logins and password links", icon: KeyRound, roles: ["OWNER"] },
      { href: "/settings", label: "Settings & audit log", description: "Policies and the audit trail", icon: Settings, roles: ["OWNER", "COORDINATOR"] },
    ],
  },
];

/** Up to four destinations in the mobile bottom bar; "More" holds the rest. */
const MOBILE_PRIMARY: Record<NavRole, string[]> = {
  OWNER: ["/", "/students", "/timetable", "/dues"],
  COORDINATOR: ["/", "/students", "/timetable", "/attendance"],
  ACCOUNTS: ["/", "/billing", "/dues", "/payouts"],
  TEACHER: ["/", "/attendance", "/students", "/payouts"],
};

/** Short labels that fit the bottom bar. */
const SHORT_LABELS: Record<string, string> = {
  "/": "Home",
  "/students": "Students",
  "/timetable": "Timetable",
  "/attendance": "Attendance",
  "/dues": "Dues",
  "/billing": "Invoices",
  "/payouts": "Payouts",
};

function asRole(role: string): NavRole {
  return (ALL as string[]).includes(role) ? (role as NavRole) : "TEACHER";
}

export function navGroupsFor(role: string): NavGroup[] {
  const r = asRole(role);
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => i.roles.includes(r))
      .map((i) => ({ href: i.href, label: i.labelFor?.[r] ?? i.label, description: i.description, icon: i.icon })),
  })).filter((g) => g.items.length > 0);
}

export function mobilePrimaryFor(role: string): NavItem[] {
  const r = asRole(role);
  const all = navGroupsFor(r).flatMap((g) => g.items);
  return MOBILE_PRIMARY[r]
    .map((href) => all.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .map((i) => ({ ...i, label: r === "TEACHER" && i.href === "/" ? "Classes" : SHORT_LABELS[i.href] ?? i.label }));
}

/** Everything not in the bottom bar, grouped, for the mobile "More" menu. */
export function mobileMoreFor(role: string): NavGroup[] {
  const primary = new Set(MOBILE_PRIMARY[asRole(role)]);
  return navGroupsFor(role)
    .map((g) => ({ ...g, items: g.items.filter((i) => !primary.has(i.href)) }))
    .filter((g) => g.items.length > 0);
}

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
