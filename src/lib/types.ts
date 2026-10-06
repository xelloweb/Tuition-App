export type UserRole = "OWNER" | "COORDINATOR" | "TEACHER" | "ACCOUNTS";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teacherId?: string | null;
}

export type SessionOutcome =
  | "COMPLETED"
  | "STUDENT_NO_SHOW"
  | "TEACHER_NO_SHOW"
  | "CANCELLED";

export type StudentAttendance = "PRESENT" | "LATE" | "ABSENT";

export type PackageStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "EXHAUSTED"
  | "EXPIRED"
  | "CLOSED";

export type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type PaymentMethod =
  | "UPI"
  | "BANK_TRANSFER"
  | "CASH"
  | "CARD"
  | "STRIPE"
  | "RAZORPAY";

export interface SubjectBalanceCalculation {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string;
  allocatedCredits: number;
  consumedCredits: number;
  remainingCredits: number; // allocated - consumed
  reservedCredits: number; // upcoming scheduled sessions
  availableCredits: number; // remaining - reserved
}

export interface PackageBalanceBreakdown {
  packageId: string;
  packageNumber: string;
  packageName: string;
  totalEntitlement: number;
  unallocatedCredits: number;
  totalAllocated: number;
  totalConsumed: number;
  totalRemaining: number; // totalEntitlement - totalConsumed
  totalReserved: number;
  totalAvailable: number; // totalRemaining - totalReserved
  subjects: SubjectBalanceCalculation[];
  status: PackageStatus;
  startDate: string;
  expiryDate?: string | null;
}

export interface ReallocationProposal {
  packageId: string;
  reason: string;
  allocations: {
    subjectId: string;
    newAllocatedCredits: number;
  }[];
  unallocatedCredits?: number;
}

export interface ReallocationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  affectedSessions: {
    sessionId: string;
    subjectId: string;
    subjectName: string;
    scheduledStartTimeUtc: Date;
    teacherName: string;
  }[];
  preview: SubjectBalanceCalculation[];
}
