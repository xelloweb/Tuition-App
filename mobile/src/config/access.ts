/**
 * Which staff roles may open each admin screen. Mirrors the website menu
 * (src/components/layout/navigation.ts) and the checks in /api/mobile/admin:
 * the server refuses everything else, so the app does not offer it.
 */
const SCREEN_ROLES: Record<string, string[]> = {
  AdminDashboard: ["OWNER", "COORDINATOR"],
  AdminStudents: ["OWNER", "COORDINATOR", "ACCOUNTS"],
  AdminTeachers: ["OWNER", "COORDINATOR", "ACCOUNTS"],
  AdminAdmissions: ["OWNER", "COORDINATOR"],
  AdminTimetable: ["OWNER", "COORDINATOR"],
  AdminAttendance: ["OWNER", "COORDINATOR"],
  AdminPackages: ["OWNER", "COORDINATOR"],
  AdminBilling: ["OWNER", "ACCOUNTS"],
  AdminPayouts: ["OWNER", "ACCOUNTS"],
  AdminReports: ["OWNER", "COORDINATOR", "ACCOUNTS"],
};

export function canOpenScreen(role: string | null | undefined, screen: string): boolean {
  const allowed = SCREEN_ROLES[screen];
  if (!allowed) return true; // screens open to every staff login, e.g. the profile
  return Boolean(role && allowed.includes(role));
}
