import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { UserRole, CurrentUser } from "./types";

export const DEMO_USERS: Record<string, CurrentUser> = {
  admin: {
    id: "usr-admin",
    name: "Devanand Nambiar (Admin / Owner)",
    email: "admin@xellotuition.com",
    role: "OWNER",
  },
  coordinator: {
    id: "usr-coord",
    name: "Aisha Nair (Academic Coordinator)",
    email: "coordinator@xellotuition.com",
    role: "COORDINATOR",
  },
  teacher_rahul: {
    id: "usr-rahul",
    name: "Rahul Varma (Teacher - Chemistry)",
    email: "teacher.rahul@xellotuition.com",
    role: "TEACHER",
    teacherId: "tch-rahul",
  },
  teacher_priya: {
    id: "usr-priya",
    name: "Priya Menon (Teacher - English)",
    email: "teacher.priya@xellotuition.com",
    role: "TEACHER",
    teacherId: "tch-priya",
  },
  accounts: {
    id: "usr-accounts",
    name: "Joseph Thomas (Accounts Manager)",
    email: "accounts@xellotuition.com",
    role: "ACCOUNTS",
  },
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const personaKey = cookieStore.get("xello_user_persona")?.value || "admin";
  const user = DEMO_USERS[personaKey] || DEMO_USERS.admin;
  return user;
}

export function canAccessAcademic(role: UserRole): boolean {
  return role === "OWNER" || role === "COORDINATOR";
}

export function canAccessFinancial(role: UserRole): boolean {
  return role === "OWNER" || role === "ACCOUNTS";
}

export function canReallocatePackages(role: UserRole): boolean {
  return role === "OWNER" || role === "COORDINATOR";
}

export function canVerifyPayments(role: UserRole): boolean {
  return role === "OWNER" || role === "ACCOUNTS";
}

export function canApprovePayouts(role: UserRole): boolean {
  return role === "OWNER";
}

export function canMarkAttendance(
  role: UserRole,
  teacherId?: string | null,
  sessionTeacherId?: string
): boolean {
  if (role === "OWNER" || role === "COORDINATOR") return true;
  if (role === "TEACHER") {
    // Teacher can only mark attendance for their own sessions!
    return !!teacherId && !!sessionTeacherId && teacherId === sessionTeacherId;
  }
  return false;
}
