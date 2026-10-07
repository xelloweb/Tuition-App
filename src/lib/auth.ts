import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { UserRole, CurrentUser } from "./types";
import { ApiError, forbiddenError } from "./api-errors";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

import { redirect } from "next/navigation";

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  
  if (session?.user) {
    return {
      id: (session.user as any).id,
      name: session.user.name || "Unknown",
      email: session.user.email || "",
      role: (session.user as any).role as UserRole,
      teacherId: (session.user as any).teacherId || null,
    };
  }
  
  redirect("/login");
}

/** For API routes: resolves the caller or fails with 401 (expired / missing session). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  }
  return user;
}

export function requirePermission(allowed: boolean, message?: string): void {
  if (!allowed) throw forbiddenError(message);
}

/** Owner and coordinators manage academic records (students, enrolments, subjects, schedules). */
export function canAccessAcademic(role: UserRole): boolean {
  return role === "OWNER" || role === "COORDINATOR";
}

export const canManageStudents = canAccessAcademic;
export const canManageTeachers = canAccessAcademic;
export const canScheduleSessions = canAccessAcademic;
export const canCorrectAttendance = canAccessAcademic;

/** Roles that may see the full student directory (teachers only see their own students). */
export function canViewAllStudents(role: UserRole): boolean {
  return role === "OWNER" || role === "COORDINATOR" || role === "ACCOUNTS";
}

/** Pay rates are financial data: only the owner may set them. */
export function canManageTeacherRates(role: UserRole): boolean {
  return role === "OWNER";
}

export function canViewTeacherRates(
  role: UserRole,
  viewerTeacherId?: string | null,
  teacherId?: string
): boolean {
  if (role === "OWNER" || role === "ACCOUNTS") return true;
  return role === "TEACHER" && !!viewerTeacherId && viewerTeacherId === teacherId;
}

export function canAccessFinancial(role: UserRole): boolean {
  return role === "OWNER" || role === "ACCOUNTS";
}

export function canLogFollowUps(role: UserRole): boolean {
  return role === "OWNER" || role === "COORDINATOR" || role === "ACCOUNTS";
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

/** A teacher may see a student they are assigned to or have a session with. */
export async function teacherCanAccessStudent(
  teacherId: string | null | undefined,
  studentId: string
): Promise<boolean> {
  if (!teacherId) return false;
  const [enrolment, session] = await Promise.all([
    prisma.subjectEnrollment.findFirst({ where: { studentId, teacherId }, select: { id: true } }),
    prisma.session.findFirst({ where: { studentId, teacherId }, select: { id: true } }),
  ]);
  return Boolean(enrolment || session);
}

export async function canViewStudent(user: CurrentUser, studentId: string): Promise<boolean> {
  if (canViewAllStudents(user.role)) return true;
  if (user.role === "TEACHER") return teacherCanAccessStudent(user.teacherId, studentId);
  return false;
}
