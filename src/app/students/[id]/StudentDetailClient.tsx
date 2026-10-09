"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  GraduationCap,
  Layers,
  CalendarDays,
  CheckCircle2,
  Receipt,
  FileText,
  AlertCircle,
  History,
  MapPin,
  Clock,
  Sparkles,
  MessageCircle,
  Edit2,
  Trash2,
  BookOpen,
  Plus,
  UserCog,
  X,
  Link2,
} from "lucide-react";
import { formatInTimeZone, formatDateOnly } from "@/lib/timezones";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { ReallocateModal } from "@/components/packages/ReallocateModal";
import { CreditLedgerModal } from "@/components/packages/CreditLedgerModal";
import { EditPackageModal } from "@/components/packages/EditPackageModal";
import { EditStudentModal } from "@/components/students/EditStudentModal";
import { AssignExistingPaymentDialog } from "@/components/packages/AssignExistingPaymentDialog";
import type { ExistingPaymentOptions } from "@/lib/services/existing-payment-packages";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { EnrollSubjectModal } from "@/components/students/EnrollSubjectModal";
import { WeeklyTimetable } from "@/components/students/WeeklyTimetable";
import { MarkAttendanceModal } from "@/components/attendance/MarkAttendanceModal";
import { EditAttendanceModal, AttendanceRecordForEdit } from "@/components/attendance/EditAttendanceModal";
import { DeleteAttendanceModal } from "@/components/attendance/DeleteAttendanceModal";
import { SubjectOption, TeacherOption } from "@/components/students/StudentFormModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { MobileTabs } from "@/components/ui/MobileTabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TimetableView } from "@/lib/services/timetable";
import type { PackageBalanceBreakdown } from "@/lib/types";
import { RemovePackageDialog } from "@/components/packages/RemovePackageDialog";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface StudentDetailClientProps {
  notFound?: boolean;
  student?: any;
  packages?: (PackageBalanceBreakdown | null)[];
  financialSummary?: any;
  timetable?: TimetableView;
  availableSubjects?: SubjectOption[];
  availableTeachers?: TeacherOption[];
  activity?: { id: string; action: string; actorName: string; createdAt: string; details: string }[];
  ledger?: { id: string; eventType: string; creditsDelta: number; reason: string; actorName: string; createdAt: string }[];
  viewerTimeZone?: string;
  permissions?: { canManage: boolean; canSchedule: boolean; canReallocate: boolean; canEditPackage?: boolean; canRemovePackage?: boolean; showFinancial: boolean; showFollowUps: boolean };
  /** Owner only, and only when money already paid is not yet a working package. */
  existingPayment?: ExistingPaymentOptions | null;
  /** Tab to open first (e.g. ?tab=packages). */
  initialTab?: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_STUDENT: "Student registered",
  UPDATE_STUDENT: "Profile updated",
  ARCHIVE_STUDENT: "Student archived",
  ENROLL_SUBJECT: "Subject enrolled",
  REASSIGN_SUBJECT_TRAINER: "Trainer assigned / changed",
  UNENROLL_SUBJECT: "Subject unenrolled",
  UPDATE_TIMETABLE: "Weekly timetable changed",
  GENERATE_TIMETABLE_CLASSES: "Classes booked from timetable",
  EDIT_PACKAGE: "Package updated",
};

export function StudentDetailClient({
  notFound,
  student,
  packages = [],
  financialSummary,
  timetable,
  availableSubjects = [],
  availableTeachers = [],
  activity = [],
  ledger = [],
  viewerTimeZone = "Asia/Kolkata",
  permissions = { canManage: false, canSchedule: false, canReallocate: false, canEditPackage: false, showFinancial: false, showFollowUps: false },
  existingPayment = null,
  initialTab,
}: StudentDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab ?? "overview");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editStartStep, setEditStartStep] = useState<"package" | undefined>(undefined);
  const [selectedForEdit, setSelectedForEdit] = useState<PackageBalanceBreakdown | null>(null);
  const [removingPackage, setRemovingPackage] = useState<{ id: string; number: string } | null>(null);
  const [selectedForRealloc, setSelectedForRealloc] = useState<PackageBalanceBreakdown | null>(null);
  const [selectedForLedger, setSelectedForLedger] = useState<{ id: string; number: string; name: string } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [deleteInvoiceLoading, setDeleteInvoiceLoading] = useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState<string | null>(null);
  const [enrollModal, setEnrollModal] = useState<null | { reassign?: { subjectId: string; subjectName: string; teacherId: string | null } }>(null);
  const [unenrollLoadingId, setUnenrollLoadingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Manual Attendance modal states
  const [markAttendanceOpen, setMarkAttendanceOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecordForEdit | null>(null);
  const [deletingAttendance, setDeletingAttendance] = useState<any | null>(null);

  if (notFound || !student) {
    return (
      <div className="space-y-6 max-w-lg mx-auto py-16 text-center px-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-10 space-y-4 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Student profile not found</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This student record does not exist or was removed. Return to the directory to see all registered students.
          </p>
          <div className="pt-2">
            <Link
              href="/students"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Students Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const enrolments: any[] = student.enrolments || [];
  const sessions: any[] = student.sessions || [];
  const invoices: any[] = student.invoices || [];
  const payments: any[] = student.payments || [];
  const followUps: any[] = student.followUps || [];
  const progressReports: any[] = student.progressReports || [];
  const balances = packages.filter(Boolean) as PackageBalanceBreakdown[];

  const activePackage =
    balances.find((p) => p.status === "ACTIVE" && p.subjects.length > 0) ||
    balances.find((p) => p.status === "ACTIVE") ||
    balances[0] ||
    null;

  const hasUnassignedPayment = Boolean(
    existingPayment &&
      (existingPayment.unsetPackages.length > 0 ||
        existingPayment.unlinkedInvoices.length > 0 ||
        existingPayment.unusedTotal > 0)
  );

  const showSuccess = (text: string) => {
    setBanner({ tone: "success", text });
    router.refresh();
  };

  const handleUnenroll = async (enrollmentId: string, subjectName: string) => {
    if (!confirm(`Unenroll ${student.name} from "${subjectName}"? Weekly slots for this subject stop and future booked classes are released; past classes are kept.`)) {
      return;
    }
    setUnenrollLoadingId(enrollmentId);
    try {
      const data = await apiRequest<{ message: string }>(
        `/api/students/${student.id}/enrolments?enrollmentId=${encodeURIComponent(enrollmentId)}`,
        { method: "DELETE" }
      );
      showSuccess(data.message);
    } catch (err) {
      setBanner({ tone: "error", text: errorMessage(err, "Failed to unenroll subject.") });
    } finally {
      setUnenrollLoadingId(null);
    }
  };

  const handleDeleteStudent = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/students/${student.id}`, { method: "DELETE" });
      router.push("/students");
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not remove this student."));
      if (err instanceof ClientApiError && err.status === 404) router.refresh();
      setDeleteLoading(false);
    }
  };

  const handleArchive = async () => {
    setDeleteLoading(true);
    try {
      await apiRequest(`/api/students/${student.id}`, { method: "PATCH", body: { status: "WITHDRAWN" } });
      setDeleteModalOpen(false);
      showSuccess(`${student.name} archived (status: Withdrawn). All records are kept.`);
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not archive this student."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeleteInvoiceLoading(true);
    setDeleteInvoiceError(null);
    try {
      const data = await apiRequest<{ message: string }>(`/api/invoices/${invoiceToDelete.id}`, {
        method: "DELETE",
      });
      setInvoiceToDelete(null);
      showSuccess(data.message || `Invoice ${invoiceToDelete.invoiceNumber} removed.`);
    } catch (err: any) {
      setDeleteInvoiceError(errorMessage(err, "Failed to remove invoice."));
    } finally {
      setDeleteInvoiceLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "subjects", label: "Subjects & Trainers", icon: GraduationCap },
    { id: "timetable", label: "Timetable", icon: CalendarDays },
    { id: "packages", label: "Packages & Balances", icon: Layers },
    { id: "attendance", label: "Attendance", icon: CheckCircle2 },
    ...(permissions.showFinancial ? [{ id: "billing", label: "Fees & Payments", icon: Receipt }] : []),
    { id: "progress", label: "Progress", icon: FileText },
    ...(permissions.showFollowUps ? [{ id: "followups", label: "Follow-ups", icon: AlertCircle }] : []),
    { id: "activity", label: "Activity History", icon: History },
  ];

  const timetableKey = timetable
    ? `${timetable.timeZone}|${timetable.slots.map((s) => `${s.id}:${s.enrolmentId}:${s.teacherId}:${s.weekday}:${s.startMinutes}:${s.endMinutes}`).join(",")}|${timetable.enrolments.map((e) => `${e.id}:${e.teacherId}`).join(",")}`
    : "none";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/students" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
        <span className="text-xs font-mono font-bold text-slate-400">Student ID: {student.studentCode}</span>
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-xs font-semibold ${
            banner.tone === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-rose-500/15 border-rose-500/30 text-rose-200"
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss message" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1 shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white break-words">{student.name}</h1>
              <StatusBadge status={student.status} size="md" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{student.grade} • {student.board} ({student.medium})</span>
              <span className="flex items-center gap-1 font-medium text-slate-300"><MapPin className="h-3.5 w-3.5 text-teal-400" />{student.country}</span>
              <span className="flex items-center gap-1 font-medium text-slate-300"><Clock className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />Times in IST</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {student.whatsappNumber && (
              <a
                href={`https://wa.me/${String(student.whatsappNumber).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hello ${student.guardianName || "Parent"}, greetings from Xello Tuition regarding ${student.name}'s tuition classes.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400 px-4 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Parent
              </a>
            )}
            {permissions.canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5 text-teal-400" /> Edit Student
                </button>
                <button
                  type="button"
                  onClick={() => { setDeleteError(null); setDeleteModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove / Archive
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800/80">
          <MobileTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {hasUnassignedPayment && existingPayment && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-slate-900/90 p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-base font-bold text-white">Payment Received · Package Not Assigned</h3>
                    <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold">
                      Action Needed
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Payment has already been collected for this student, but no working package is assigned yet.
                    Assigning a package links this existing payment and creates <strong className="text-white">₹0 new payment or fee</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAssignOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400 px-4 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-teal-500/20 transition-all"
                  >
                    <Link2 className="h-4 w-4" /> Assign Package Using Existing Payment
                  </button>
                  {permissions.canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditStartStep("package");
                        setEditModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Purchase / Add New Package
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-amber-500/20 text-center">
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Payment Received</span>
                  <div className="text-lg font-bold text-emerald-400">
                    ₹{existingPayment.availablePaidAmount.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Current Package</span>
                  <div className="text-lg font-bold text-amber-300">
                    {balances.length > 0 ? "Setup Pending" : "Not Assigned"}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">New Payment Created</span>
                  <div className="text-lg font-bold text-teal-300">₹0</div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Payment Source</span>
                  <div className="text-xs font-bold text-slate-200 mt-1 truncate">
                    {existingPayment.unsetPackages.length > 0
                      ? `Package ${existingPayment.unsetPackages[0].packageNumber}`
                      : existingPayment.unlinkedInvoices.length > 0
                      ? `Invoice ${existingPayment.unlinkedInvoices[0].invoiceNumber}`
                      : `${existingPayment.unusedPayments.length} Payment(s)`}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
                <span>
                  🟢 <strong>Assign Package Using Existing Payment:</strong> Maps existing payment to class credits. Student total collected remains unchanged.
                </span>
                <span>
                  ⚪ <strong>Purchase / Add New Package:</strong> Generates a fresh invoice for parent to pay.
                </span>
              </div>
            </div>
          )}

          {activePackage && (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Layers className="h-4 w-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">Current Package & Classes</h3>
                  <span className="text-xs font-semibold text-slate-300">({activePackage.packageName})</span>
                  <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                    {activePackage.packageNumber}
                  </span>
                  <StatusBadge status={activePackage.status} size="sm" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {permissions.canEditPackage && (
                    <button
                      type="button"
                      onClick={() => setSelectedForEdit(activePackage)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Edit2 className="h-3 w-3 text-teal-400" />
                      Edit Package
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("packages")}
                    className="inline-flex items-center min-h-[44px] text-xs font-bold text-teal-400 hover:text-teal-300 hover:underline transition-colors text-left sm:text-right"
                  >
                    View Full Breakdown & Ledger →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-2xl bg-slate-900/90 p-4 border border-slate-800 text-center">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Package Value</span>
                  <div className="text-base font-bold text-white">
                    ₹{(activePackage.price ?? 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Amount Paid</span>
                  <div className="text-base font-bold text-emerald-400">
                    ₹{(activePackage.paidAmount ?? (activePackage.price ?? 0)).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Entitled</span>
                  <div className="text-base font-bold text-white">{activePackage.totalEntitlement}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Consumed</span>
                  <div className="text-base font-bold text-slate-300">{activePackage.totalConsumed}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Remaining</span>
                  <div className="text-base font-bold text-teal-400">{activePackage.totalRemaining}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-teal-400" />
                  <span>Started: <strong className="text-slate-200">{formatDateOnly(activePackage.startDate)}</strong></span>
                  <span>•</span>
                  <span>Valid until: <strong className="text-slate-200">{activePackage.expiryDate ? formatDateOnly(activePackage.expiryDate) : "No expiry"}</strong></span>
                </div>
                {activePackage.unallocatedCredits > 0 ? (
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <span>⚠️ {activePackage.unallocatedCredits} class(es) unallocated</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (existingPayment) setAssignOpen(true);
                        else setSelectedForRealloc(activePackage);
                      }}
                      className="inline-flex items-center min-h-[44px] text-xs underline hover:text-white font-bold"
                    >
                      Allocate now
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 truncate max-w-md">
                    Enrolled subjects: {activePackage.subjects.map((s) => `${s.subjectName} (${s.remainingCredits} left)`).join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Academic & Contact Profile</h3>
              <dl className="space-y-2.5 text-xs">
                {[
                  ["Student Code", <span key="c" className="font-mono font-bold text-white">{student.studentCode}</span>],
                  ["Parent / Guardian", <span key="g" className="font-bold text-white">{student.guardianName}</span>],
                  ["WhatsApp Contact", <span key="w" className="font-mono text-white">{student.whatsappNumber}</span>],
                  ["Email Address", <span key="e" className="text-slate-200 break-all">{student.email || "Not provided"}</span>],
                  ["Country", <span key="t" className="font-semibold text-white">{student.country}</span>],
                  ["Joining Date", <span key="j" className="font-semibold text-white">{formatDateOnly(student.joiningDate)}</span>],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-3 py-1 border-b border-slate-800/60 last:border-0">
                    <dt className="text-slate-400 shrink-0">{label}</dt>
                    <dd className="text-right min-w-0">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Learning Goals & Timings</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-300">Preferred Class Timings:</span>
                  <p className="mt-1 text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">{student.preferredTimings || "Not recorded"}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-300">Learning Goals:</span>
                  <p className="mt-1 text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">{student.learningGoals || "Not recorded"}</p>
                </div>
                {student.coordinatorNotes && (
                  <div>
                    <span className="font-bold text-teal-400">Coordinator Notes:</span>
                    <p className="mt-1 text-teal-300 bg-teal-500/10 p-3 rounded-xl border border-teal-500/20">{student.coordinatorNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "subjects" && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Enrolled Subjects & Assigned Trainers ({enrolments.length})</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">A subject can be enrolled before a trainer is confirmed.</p>
            </div>
            {permissions.canManage && (
              <button
                onClick={() => setEnrollModal({})}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 transition-all"
              >
                <Plus className="h-4 w-4" /> Enroll Another Subject
              </button>
            )}
          </div>

          {enrolments.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
              <BookOpen className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No subjects enrolled yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrolments.map((enr) => (
                <div key={enr.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white/10 shrink-0" style={{ backgroundColor: enr.subject?.color || "#06b6d4" }} />
                      <span className="font-bold text-sm text-white truncate">{enr.subject?.name}</span>
                      <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-400">{enr.subject?.code}</span>
                    </div>
                    {permissions.canManage && (
                      <button
                        onClick={() => handleUnenroll(enr.id, enr.subject?.name)}
                        disabled={unenrollLoadingId === enr.id}
                        title="Unenroll subject"
                        aria-label={`Unenroll ${enr.subject?.name}`}
                        className="rounded-lg p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Assigned Trainer:</span>
                      {enr.teacher ? (
                        <span className="font-bold text-teal-300 text-right">{enr.teacher.name}{enr.teacher.active === false ? " (inactive)" : ""}</span>
                      ) : (
                        <span className="font-bold text-amber-300">Not assigned yet</span>
                      )}
                    </div>
                    {enr.teacher?.phone && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Phone:</span>
                        <span className="font-mono text-slate-300">{enr.teacher.phone}</span>
                      </div>
                    )}
                    {enr.notes && <div className="pt-1.5 mt-1 border-t border-slate-800/60 text-slate-400 italic">Note: {enr.notes}</div>}
                  </div>
                  {permissions.canManage && (
                    <button
                      type="button"
                      onClick={() => setEnrollModal({ reassign: { subjectId: enr.subjectId, subjectName: enr.subject?.name, teacherId: enr.teacherId } })}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2 min-h-[44px] text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      <UserCog className="h-3.5 w-3.5 text-teal-400" />
                      {enr.teacher ? "Change trainer" : "Assign trainer"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "timetable" && (
        <div className="space-y-6">
          {timetable && (
            <WeeklyTimetable
              key={timetableKey}
              studentId={student.id}
              view={timetable}
              teachers={availableTeachers}
              canEdit={permissions.canSchedule}
              onSaved={() => router.refresh()}
            />
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">All Sessions ({sessions.length})</h3>
            <div className="divide-y divide-slate-800/80">
              {sessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No sessions on schedule.</div>
              ) : (
                sessions.map((ses) => (
                  <div key={ses.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{ses.subject?.name}</span>
                        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300 border border-slate-700">Trainer: {ses.teacher?.name}</span>
                        <StatusBadge status={ses.status} size="sm" />
                        {ses.timetableSlotId && <span className="rounded-md bg-teal-500/10 border border-teal-500/30 px-1.5 py-0.5 text-xs text-teal-300">Weekly</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "packages" && (
        <div className="space-y-6">
          {existingPayment && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-slate-900/90 p-5 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Payment Received · Package Not Assigned
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Student has paid <strong className="text-white">₹{existingPayment.availablePaidAmount.toLocaleString("en-IN")}</strong>.
                    Assigning a package links this payment to class credits without creating any new payment or invoice fee.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" icon={Link2} onClick={() => setAssignOpen(true)}>
                    Assign package using existing payment
                  </Button>
                  {permissions.canManage && (
                    <Button
                      type="button"
                      variant="outline"
                      icon={Plus}
                      onClick={() => {
                        setEditStartStep("package");
                        setEditModalOpen(true);
                      }}
                    >
                      Purchase new package
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-400 pt-2 border-t border-amber-500/20 flex flex-wrap justify-between gap-2">
                <span>🟢 <strong>Assign package using existing payment:</strong> Links existing payment. New payment created: ₹0. Total collected unchanged.</span>
                <span>⚪ <strong>Purchase new package:</strong> New purchase: creates a new invoice for the parent to pay.</span>
              </div>
            </div>
          )}
          {!existingPayment && permissions.canManage && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                icon={Plus}
                onClick={() => {
                  setEditStartStep("package");
                  setEditModalOpen(true);
                }}
              >
                Purchase new package
              </Button>
            </div>
          )}
          {balances.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
              No packages yet.
            </div>
          )}
          {balances.map((pkg) => (
            <div key={pkg.packageId} className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-white">{pkg.packageName}</span>
                  <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">{pkg.packageNumber}</span>
                  <StatusBadge status={pkg.status} size="sm" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedForLedger({ id: pkg.packageId, number: pkg.packageNumber, name: pkg.packageName })}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 min-h-[44px] text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    View Credit Ledger
                  </button>
                  {permissions.canEditPackage && (
                    <button
                      type="button"
                      onClick={() => setSelectedForEdit(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 min-h-[44px] text-xs font-bold text-teal-300 hover:bg-teal-500/20 hover:text-teal-200 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit Package
                    </button>
                  )}
                  {permissions.canRemovePackage && (
                    <button
                      type="button"
                      onClick={() => setRemovingPackage({ id: pkg.packageId, number: pkg.packageNumber })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove wrong package
                    </button>
                  )}
                  {permissions.canReallocate && (
                    <button
                      onClick={() => setSelectedForRealloc(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400 px-3.5 py-2 min-h-[44px] text-xs font-bold text-slate-950 hover:brightness-110 transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Reallocate Classes
                    </button>
                  )}
                </div>
              </div>

              {(pkg.price !== undefined || permissions.showFinancial) && (
                <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400">Package Value: <strong className="text-white">₹{(pkg.price ?? 0).toLocaleString("en-IN")}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Amount Paid: <strong className="text-emerald-400">₹{(pkg.paidAmount ?? (pkg.price ?? 0)).toLocaleString("en-IN")}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Balance Due: <strong className={pkg.balanceDue && pkg.balanceDue > 0 ? "text-amber-400" : "text-slate-300"}>₹{(pkg.balanceDue ?? 0).toLocaleString("en-IN")}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Validity: <strong className="text-slate-200">{formatDateOnly(pkg.startDate)} to {pkg.expiryDate ? formatDateOnly(pkg.expiryDate) : "No expiry"}</strong></span>
                </div>
              )}

              {/* Consumed = attended classes; Remaining = Entitled − Consumed. Booked future classes are not consumed. */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-900/90 p-4 border border-slate-800 text-center">
                {[
                  ["Entitled", pkg.totalEntitlement, "text-white"],
                  ["Consumed", pkg.totalConsumed, "text-slate-300"],
                  ["Remaining", pkg.totalRemaining, "text-teal-400"],
                ].map(([label, value, color]) => (
                  <div key={label as string}>
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                    <div className={`text-lg font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              {pkg.unallocatedCredits > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
                  <span>⚠️ {pkg.unallocatedCredits} class(es) are not yet allocated to a subject.</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (existingPayment) setAssignOpen(true);
                      else setSelectedForRealloc(pkg);
                    }}
                    className="inline-flex items-center min-h-[44px] rounded-lg bg-amber-400 px-3 py-1 font-bold text-slate-950 hover:brightness-110 transition-all"
                  >
                    Allocate to subjects
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pkg.subjects.map((sub) => (
                  <div key={sub.subjectId} className="rounded-2xl border border-slate-800 p-4 space-y-2 bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sub.subjectColor }} />
                        <span className="text-xs font-bold text-white">{sub.subjectName}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">{sub.subjectCode}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center pt-2 border-t border-slate-800">
                      {[
                        ["Allocated", sub.allocatedCredits, "text-white"],
                        ["Consumed", sub.consumedCredits, "text-slate-300"],
                        ["Remaining", sub.remainingCredits, "text-teal-400"],
                      ].map(([label, value, color]) => (
                        <div key={label as string}>
                          <div className="text-xs text-slate-400">{label}</div>
                          <div className={`font-bold ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="space-y-4">
          {/* Package attendance metrics summary */}
          {activePackage && (
            <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-slate-900 to-slate-900/90 p-4 sm:p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-400" />
                  <span className="font-bold text-white text-sm">Package Attendance & Credit Tracking</span>
                  <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                    {activePackage.packageNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMarkAttendanceOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Mark Attendance
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Active Package</span>
                  <div className="text-sm font-bold text-white truncate mt-0.5">{activePackage.packageName}</div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Total Package Classes</span>
                  <div className="text-lg font-bold text-white mt-0.5">{activePackage.totalEntitlement} Classes</div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Completed Class Hours</span>
                  <div className="text-lg font-bold text-slate-300 mt-0.5">{activePackage.totalConsumed} Hours</div>
                </div>
                <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Remaining Class Credits</span>
                  <div className="text-lg font-bold text-teal-300 mt-0.5">{activePackage.totalRemaining} Credits</div>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-teal-200/80">
                ℹ️ Only manually confirmed attendance reduces package credits (1 hr = 1 credit, 2 hrs = 2 credits, 3 hrs = 3 credits).
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal-400" />
                Attendance History & Class Logs ({sessions.filter((s) => s.attendance).length})
              </h3>
              {!activePackage && (
                <button
                  type="button"
                  onClick={() => setMarkAttendanceOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Mark Attendance
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-800/80">
              {sessions.filter((s) => s.attendance).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No attendance records yet.</div>
              ) : (
                sessions
                  .filter((s) => s.attendance)
                  .map((ses) => {
                    const durationHours = (ses.attendance!.actualDurationMinutes / 60).toFixed(1);
                    const creditsDeducted = Math.max(1, Math.round(ses.attendance!.actualDurationMinutes / 60));
                    return (
                      <div key={ses.id} className="py-4 space-y-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-sm">{ses.subject?.name}</span>
                            <span className="rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-xs font-bold text-teal-300">
                              {durationHours}h Completed ({creditsDeducted} Credit{creditsDeducted > 1 ? "s" : ""})
                            </span>
                            <StatusBadge status={ses.attendance!.sessionOutcome} size="sm" />
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700">
                              {ses.attendance!.studentAttendance}
                            </span>
                            {ses.attendance!.isReversed && <StatusBadge status="REVERSED" size="sm" />}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingAttendance({
                                  id: ses.attendance!.id,
                                  studentName: student.name,
                                  subjectName: ses.subject?.name || "Subject",
                                  teacherName: ses.teacher?.name || "Trainer",
                                  classDate: ses.scheduledStartTimeUtc.toString(),
                                  durationMinutes: ses.attendance!.actualDurationMinutes,
                                  topicCovered: ses.attendance!.topicCovered,
                                  homework: ses.attendance!.homework || undefined,
                                  studentProgressNote: ses.attendance!.studentProgressNote || undefined,
                                })
                              }
                              className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700"
                            >
                              <Edit2 className="h-3 w-3 text-teal-400" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingAttendance({
                                  id: ses.attendance!.id,
                                  studentName: student.name,
                                  subjectName: ses.subject?.name || "Subject",
                                  teacherName: ses.teacher?.name || "Trainer",
                                  durationMinutes: ses.attendance!.actualDurationMinutes,
                                  hoursCompleted: ses.attendance!.actualDurationMinutes / 60,
                                })
                              }
                              className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 text-xs">
                          <span>
                            Class Date: <strong className="text-slate-200">{formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Trainer: <strong className="text-slate-200">{ses.teacher?.name || "Trainer"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Marked by: <strong className="text-slate-300">{ses.attendance!.markedByName} ({ses.attendance!.markedByRole})</strong>
                          </span>
                        </div>

                        <div className="text-slate-300">
                          <strong className="text-white">Topic:</strong> {ses.attendance!.topicCovered}
                        </div>
                        {ses.attendance!.homework && (
                          <div className="text-slate-400">
                            <strong className="text-slate-300">Homework:</strong> {ses.attendance!.homework}
                          </div>
                        )}
                        {ses.attendance!.studentProgressNote && (
                          <div className="text-teal-300 bg-teal-500/10 border border-teal-500/20 p-2.5 rounded-xl text-xs">
                            <strong>Trainer Note:</strong> {ses.attendance!.studentProgressNote}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "billing" && permissions.showFinancial && financialSummary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["Net Billed", financialSummary.netBilled, "text-white"],
              ["Verified Paid", financialSummary.verifiedPayments, "text-emerald-400"],
              ["Balance Outstanding", financialSummary.outstanding, "text-blue-400"],
              ["Overdue", financialSummary.overdue, "text-rose-400"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="rounded-2xl border border-slate-800 bg-[#0c1220]/80 p-4">
                <span className="text-xs text-slate-400 font-medium">{label}</span>
                <div className={`text-lg sm:text-xl font-bold font-mono ${color}`}>₹{Number(value).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
          {financialSummary.unallocatedAdvances > 0 && (
            <p className="text-xs text-teal-300">Unallocated verified advance: ₹{financialSummary.unallocatedAdvances.toLocaleString("en-IN")}</p>
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Invoices</h3>
            <div className="divide-y divide-slate-800/80">
              {invoices.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No invoices yet.</div>}
              {invoices.map((inv) => (
                <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{inv.invoiceNumber}</span>
                      <StatusBadge status={inv.status} size="sm" />
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Due: {formatDateOnly(inv.dueDate)} • Total: ₹{inv.totalAmount.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="sm:text-right">
                      <div className="font-bold text-white">Balance Due: ₹{inv.balanceDue.toLocaleString("en-IN")}</div>
                      <div className="text-xs text-slate-400">Paid: ₹{inv.paidAmount.toLocaleString("en-IN")}</div>
                    </div>
                    {inv.paidAmount === 0 && permissions.showFinancial && (
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceToDelete(inv);
                          setDeleteInvoiceError(null);
                        }}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors"
                        title="Remove unpaid invoice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Payment Records & Proofs</h3>
            <div className="divide-y divide-slate-800/80">
              {payments.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No payments recorded.</div>}
              {payments.map((pay) => (
                <div key={pay.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-white">{pay.paymentNumber}</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${pay.isVerified ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-amber-500/15 border border-amber-500/30 text-amber-400"}`}>
                        {pay.isVerified ? "VERIFIED" : "PROOF UPLOADED (UNVERIFIED)"}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-0.5">Method: {pay.paymentMethod} • Ref: {pay.reference || "N/A"}</div>
                  </div>
                  <div className="font-bold text-sm text-white font-mono">₹{pay.amount.toLocaleString("en-IN")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "progress" && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">Monthly Progress & Assessments</h3>
          {progressReports.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No progress reports yet.</div>}
          <div className="space-y-4">
            {progressReports.map((prog) => (
              <div key={prog.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-white">{prog.subject?.name} • Month: {prog.monthYear}</span>
                  <span className="rounded-lg bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-xs font-bold text-teal-400">Homework: {prog.homeworkCompletionRate}%</span>
                </div>
                <div className="text-slate-300"><strong className="text-white">Curriculum Progress:</strong> {prog.topicProgress}</div>
                {prog.areasOfImprovement && <div className="text-amber-300"><strong className="text-amber-400">Improvement Areas:</strong> {prog.areasOfImprovement}</div>}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300"><strong className="text-white">Trainer Feedback:</strong> {prog.teacherFeedback}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "followups" && permissions.showFollowUps && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white">Communication & Due Follow-up Queue</h3>
          <div className="divide-y divide-slate-800/80">
            {followUps.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No follow-ups logged for this student.</div>
            ) : (
              followUps.map((fol) => (
                <div key={fol.id} className="py-3.5 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white">Type: {fol.type} • Assigned: {fol.assignedStaff}</span>
                    <span className="text-slate-400">{formatInTimeZone(fol.contactDate, "Asia/Kolkata")}</span>
                  </div>
                  {fol.outcome && <div><strong className="text-white">Outcome:</strong> {fol.outcome}</div>}
                  {fol.parentResponse && <div className="text-slate-300"><strong className="text-white">Parent Response:</strong> {fol.parentResponse}</div>}
                  {fol.notes && <div className="text-slate-400 italic">Notes: {fol.notes}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white">Profile & Timetable Changes</h3>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400">No recorded changes yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800/80 text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-white">{ACTION_LABELS[a.action] ?? a.action}</span>
                      <span className="text-xs text-slate-400">{formatInTimeZone(a.createdAt, "Asia/Kolkata")} IST</span>
                    </div>
                    <div className="text-xs text-slate-400">by {a.actorName}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220]/90 p-4 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white">Credit Ledger Events</h3>
            {ledger.length === 0 ? (
              <p className="text-xs text-slate-400">No credit events yet.</p>
            ) : (
              <ul className="divide-y divide-slate-800/80 text-xs">
                {ledger.map((l) => (
                  <li key={l.id} className="py-2.5">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-white">{l.eventType.replace(/_/g, " ")}</span>
                      <span className={`font-mono font-bold ${l.creditsDelta >= 0 ? "text-emerald-400" : "text-rose-300"}`}>
                        {l.creditsDelta > 0 ? `+${l.creditsDelta}` : l.creditsDelta}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{l.reason}</div>
                    <div className="text-xs text-slate-400">{l.actorName} · {formatInTimeZone(l.createdAt, "Asia/Kolkata")} IST</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {removingPackage && (
        <RemovePackageDialog
          packageId={removingPackage.id}
          packageNumber={removingPackage.number}
          onClose={() => setRemovingPackage(null)}
          onRemoved={(message) => {
            setRemovingPackage(null);
            showSuccess(message);
          }}
        />
      )}

      {selectedForEdit && (
        <EditPackageModal
          pkg={selectedForEdit}
          studentName={student.name}
          studentCode={student.studentCode}
          onClose={() => setSelectedForEdit(null)}
          onSuccess={() => {
            setSelectedForEdit(null);
            showSuccess("Package updated successfully. Balances and records recalculated.");
            router.refresh();
          }}
        />
      )}

      {selectedForRealloc && (
        <ReallocateModal
          pkg={selectedForRealloc}
          onClose={() => setSelectedForRealloc(null)}
          onSuccess={() => {
            setSelectedForRealloc(null);
            showSuccess("Classes reallocated. The credit ledger records the change.");
          }}
        />
      )}

      {selectedForLedger && (
        <CreditLedgerModal
          packageId={selectedForLedger.id}
          packageNumber={selectedForLedger.number}
          packageName={selectedForLedger.name}
          onClose={() => setSelectedForLedger(null)}
        />
      )}

      {editModalOpen && (
        <EditStudentModal
          student={student}
          subjects={availableSubjects}
          teachers={availableTeachers}
          startStep={editStartStep}
          existingPayment={existingPayment}
          onClose={() => {
            setEditModalOpen(false);
            setEditStartStep(undefined);
          }}
          onSuccess={(_updated, message) => {
            setEditModalOpen(false);
            setEditStartStep(undefined);
            showSuccess(message);
          }}
        />
      )}

      {assignOpen && existingPayment && (
        <AssignExistingPaymentDialog
          studentId={student.id}
          options={existingPayment}
          onClose={() => setAssignOpen(false)}
          onAssigned={(message) => {
            setAssignOpen(false);
            showSuccess(message);
          }}
        />
      )}

      {deleteModalOpen && (
        <DeleteConfirmModal
          title="Remove or Archive Student"
          message={`Permanently remove "${student.name}" (${student.studentCode})? Only possible for records with no packages, classes, invoices or payments — otherwise archive the student to keep their history.`}
          itemName={`${student.name} (${student.studentCode})`}
          itemDetails={`${student.grade} • Guardian: ${student.guardianName} (${student.whatsappNumber})`}
          confirmLabel="Yes, Remove Student"
          loading={deleteLoading}
          errorMessage={deleteError}
          alternativeAction={student.status !== "WITHDRAWN" ? { label: "Archive instead", onClick: handleArchive } : undefined}
          onConfirm={handleDeleteStudent}
          onCancel={() => setDeleteModalOpen(false)}
        />
      )}

      {invoiceToDelete && (
        <DeleteConfirmModal
          title="Remove Unpaid Invoice"
          message={`Permanently remove invoice ${invoiceToDelete.invoiceNumber} for ${student.name}? This will delete the invoice and remove the ₹${invoiceToDelete.balanceDue.toLocaleString("en-IN")} outstanding balance.`}
          itemName={`${invoiceToDelete.invoiceNumber}`}
          itemDetails={`Total Amount: ₹${invoiceToDelete.totalAmount.toLocaleString("en-IN")} • Due: ${formatDateOnly(invoiceToDelete.dueDate)} • Status: ${invoiceToDelete.status}`}
          confirmLabel="Yes, Remove Invoice"
          loading={deleteInvoiceLoading}
          errorMessage={deleteInvoiceError}
          onConfirm={handleDeleteInvoice}
          onCancel={() => {
            if (!deleteInvoiceLoading) {
              setInvoiceToDelete(null);
              setDeleteInvoiceError(null);
            }
          }}
        />
      )}

      {enrollModal && (
        <EnrollSubjectModal
          studentId={student.id}
          studentName={student.name}
          availableSubjects={availableSubjects}
          availableTeachers={availableTeachers}
          currentlyEnrolledSubjectIds={enrolments.map((e) => e.subjectId)}
          reassign={enrollModal.reassign}
          subjectSlots={
            enrollModal.reassign && timetable
              ? timetable.slots.filter(
                  (sl) => timetable.enrolments.find((e) => e.id === sl.enrolmentId)?.subjectId === enrollModal.reassign!.subjectId
                )
              : []
          }
          onClose={() => setEnrollModal(null)}
          onSuccess={(message) => {
            setEnrollModal(null);
            showSuccess(message);
          }}
        />
      )}

      {markAttendanceOpen && (
        <MarkAttendanceModal
          isOpen={true}
          onClose={() => setMarkAttendanceOpen(false)}
          onSuccess={(msg) => {
            setMarkAttendanceOpen(false);
            showSuccess(msg);
          }}
          preSelectedStudent={{
            id: student.id,
            name: student.name,
            grade: student.grade,
            assignedSubjects: student.enrolments.map((e: any) => ({
              id: e.subject.id,
              name: e.subject.name,
              teacherId: e.teacher?.id ?? null,
              teacherName: e.teacher?.name ?? null,
            })),
          }}
          allTrainers={availableTeachers.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}

      {editingAttendance && (
        <EditAttendanceModal
          isOpen={true}
          onClose={() => setEditingAttendance(null)}
          onSuccess={(msg) => {
            setEditingAttendance(null);
            showSuccess(msg);
          }}
          record={editingAttendance}
        />
      )}

      {deletingAttendance && (
        <DeleteAttendanceModal
          isOpen={true}
          onClose={() => setDeletingAttendance(null)}
          onSuccess={(msg) => {
            setDeletingAttendance(null);
            showSuccess(msg);
          }}
          record={deletingAttendance}
        />
      )}
    </div>
  );
}
