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
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { ReallocateModal } from "@/components/packages/ReallocateModal";
import { CreditLedgerModal } from "@/components/packages/CreditLedgerModal";

interface StudentDetailClientProps {
  student: any;
  packages: any[];
  financialSummary: any;
}

export function StudentDetailClient({
  student,
  packages,
  financialSummary,
}: StudentDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedForRealloc, setSelectedForRealloc] = useState<any | null>(null);
  const [selectedForLedger, setSelectedForLedger] = useState<any | null>(null);

  const tabs = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "subjects", label: "Subjects & Teachers", icon: GraduationCap },
    { id: "packages", label: "Packages & Balances", icon: Layers },
    { id: "timetable", label: "Timetable", icon: CalendarDays },
    { id: "attendance", label: "Attendance", icon: CheckCircle2 },
    { id: "billing", label: "Fees & Payments", icon: Receipt },
    { id: "progress", label: "Progress", icon: FileText },
    { id: "followups", label: "Follow-ups", icon: AlertCircle },
    { id: "activity", label: "Activity History", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Quick Action */}
      <div className="flex items-center justify-between">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
        <span className="text-xs font-mono font-bold text-slate-500">
          Student ID: {student.studentCode}
        </span>
      </div>

      {/* Student Profile Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {student.name}
              </h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                {student.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {student.grade} • {student.board} ({student.medium})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                {student.country}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                {student.timeZone}
              </span>
            </div>
          </div>

          {/* WhatsApp Direct Action */}
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${student.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Hello ${student.guardianName}, greetings from Xello Tuition regarding ${student.name}'s tuition classes.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Parent ({student.whatsappNumber})
            </a>
          </div>
        </div>

        {/* 9 Tab Navigation Buttons */}
        <div className="mt-6 flex overflow-x-auto border-b border-slate-200 gap-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Academic & Contact Profile
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Student Code</span>
                <span className="font-mono font-bold text-slate-900">{student.studentCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Parent / Guardian</span>
                <span className="font-bold text-slate-900">{student.guardianName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">WhatsApp Contact</span>
                <span className="font-mono text-slate-900">{student.whatsappNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Email Address</span>
                <span className="text-slate-900">{student.email || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Country & Timezone</span>
                <span className="font-semibold text-slate-900">{student.country} • {student.timeZone}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Joining Date</span>
                <span className="font-semibold text-slate-900">
                  {formatInTimeZone(student.joiningDate, student.timeZone)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Learning Goals & Timings
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-700">Preferred Class Timings:</span>
                <p className="mt-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {student.preferredTimings || "Flexible"}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700">Learning Goals:</span>
                <p className="mt-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {student.learningGoals || "Board syllabus mastery"}
                </p>
              </div>
              {student.coordinatorNotes && (
                <div>
                  <span className="font-bold text-slate-700">Coordinator Notes:</span>
                  <p className="mt-1 text-slate-600 bg-teal-50/50 p-2.5 rounded-lg border border-teal-100">
                    {student.coordinatorNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Subjects & Teachers */}
      {activeTab === "subjects" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Enrolled Subjects & Assigned Tutors ({student.enrolments.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {student.enrolments.map((enr: any) => (
              <div
                key={enr.id}
                className="rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: enr.subject.color }}
                    />
                    <span className="font-bold text-sm text-slate-900">
                      {enr.subject.name}
                    </span>
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {enr.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Tutor: <strong>{enr.teacher.name}</strong></div>
                  <div>Phone: {enr.teacher.phone} • {enr.teacher.email}</div>
                  {enr.notes && (
                    <div className="text-slate-500 italic mt-1">{enr.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Packages & Balances */}
      {activeTab === "packages" && (
        <div className="space-y-6">
          {packages.map((pkg: any) => (
            <div
              key={pkg.packageId}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {pkg.packageName}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
                      {pkg.packageNumber}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {pkg.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedForLedger({
                        id: pkg.packageId,
                        number: pkg.packageNumber,
                        name: pkg.packageName,
                      })
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Credit Ledger
                  </button>
                  <button
                    onClick={() => setSelectedForRealloc(pkg)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Reallocate Classes
                  </button>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Entitled</span>
                  <div className="text-lg font-black text-slate-900">{pkg.totalEntitlement}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Consumed</span>
                  <div className="text-lg font-bold text-slate-700">{pkg.totalConsumed}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Remaining</span>
                  <div className="text-lg font-bold text-teal-700">{pkg.totalRemaining}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Reserved</span>
                  <div className="text-lg font-bold text-blue-700">{pkg.totalReserved}</div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Available</span>
                  <div className="text-lg font-bold text-emerald-700">{pkg.totalAvailable}</div>
                </div>
              </div>

              {/* Subjects Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pkg.subjects.map((sub: any) => (
                  <div
                    key={sub.subjectId}
                    className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: sub.subjectColor }}
                        />
                        <span className="text-xs font-bold text-slate-900">
                          {sub.subjectName}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {sub.subjectCode}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[11px] text-center pt-2 border-t border-slate-200">
                      <div>
                        <div className="text-[10px] text-slate-400">Alloc</div>
                        <div className="font-bold text-slate-900">{sub.allocatedCredits}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Used</div>
                        <div className="font-bold text-slate-600">{sub.consumedCredits}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Remain</div>
                        <div className="font-bold text-teal-700">{sub.remainingCredits}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Avail</div>
                        <div className="font-bold text-emerald-700">{sub.availableCredits}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Timetable */}
      {activeTab === "timetable" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Scheduled Sessions ({student.sessions.length})
          </h3>
          <div className="divide-y divide-slate-100">
            {student.sessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No sessions on schedule.
              </div>
            ) : (
              student.sessions.map((ses: any) => (
                <div
                  key={ses.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {ses.subject.name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        Tutor: {ses.teacher.name}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {ses.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")} IST •{" "}
                      {formatInTimeZone(ses.scheduledStartTimeUtc, student.timeZone)} ({student.country} Local)
                    </div>
                  </div>
                  {ses.meetingUrl && (
                    <a
                      href={ses.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-700 hover:bg-teal-100 text-xs shrink-0"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Attendance */}
      {activeTab === "attendance" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Attendance & Class Delivery Records
          </h3>
          <div className="divide-y divide-slate-100">
            {student.sessions.filter((s: any) => s.attendance).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No completed attendance records yet.
              </div>
            ) : (
              student.sessions
                .filter((s: any) => s.attendance)
                .map((ses: any) => (
                  <div key={ses.id} className="py-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {ses.subject.name}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {ses.attendance.sessionOutcome}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                          {ses.attendance.studentAttendance}
                        </span>
                        {ses.attendance.isReversed && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Reversed
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {formatInTimeZone(ses.scheduledStartTimeUtc, "Asia/Kolkata")}
                      </span>
                    </div>
                    <div className="text-slate-700">
                      <strong>Topic:</strong> {ses.attendance.topicCovered}
                    </div>
                    {ses.attendance.homework && (
                      <div className="text-slate-500">
                        <strong>Homework:</strong> {ses.attendance.homework}
                      </div>
                    )}
                    {ses.attendance.studentProgressNote && (
                      <div className="text-teal-800 bg-teal-50/50 p-2 rounded text-[11px]">
                        <strong>Tutor Note:</strong> {ses.attendance.studentProgressNote}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Fees & Payments */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Financial Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] text-slate-500 font-medium">Net Billed</span>
              <div className="text-xl font-bold text-slate-900">
                ₹{financialSummary.netBilled.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] text-slate-500 font-medium">Verified Paid</span>
              <div className="text-xl font-bold text-emerald-700">
                ₹{financialSummary.verifiedPayments.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] text-slate-500 font-medium">Balance Outstanding</span>
              <div className="text-xl font-bold text-blue-700">
                ₹{financialSummary.outstanding.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[11px] text-slate-500 font-medium">Overdue</span>
              <div className="text-xl font-bold text-red-700">
                ₹{financialSummary.overdue.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Invoices & Instalments</h3>
            <div className="divide-y divide-slate-100">
              {student.invoices.map((inv: any) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "OVERDUE"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Due: {formatInTimeZone(inv.dueDate, "Asia/Kolkata")} • Total: ₹{inv.totalAmount.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      Balance Due: ₹{inv.balanceDue.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Paid: ₹{inv.paidAmount.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payments & Proofs List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Payment Records & Proofs</h3>
            <div className="divide-y divide-slate-100">
              {student.payments.map((pay: any) => (
                <div key={pay.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {pay.paymentNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pay.isVerified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {pay.isVerified ? "VERIFIED" : "PROOF UPLOADED (UNVERIFIED)"}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Method: {pay.paymentMethod} • Ref: {pay.reference || "N/A"}
                    </div>
                    {pay.proofFileName && (
                      <div className="text-[11px] text-teal-700 mt-0.5 flex items-center gap-1">
                        <span>Attachment: {pay.proofFileName}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right font-bold text-sm text-slate-900">
                    ₹{pay.amount.toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Progress */}
      {activeTab === "progress" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Monthly Progress & Assessments
          </h3>
          <div className="space-y-4">
            {student.progressReports.map((prog: any) => (
              <div key={prog.id} className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">
                    {prog.subject.name} • Month: {prog.monthYear}
                  </span>
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">
                    Homework: {prog.homeworkCompletionRate}%
                  </span>
                </div>
                <div className="text-slate-700">
                  <strong>Curriculum Progress:</strong> {prog.topicProgress}
                </div>
                {prog.areasOfImprovement && (
                  <div className="text-amber-800">
                    <strong>Improvement Areas:</strong> {prog.areasOfImprovement}
                  </div>
                )}
                <div className="bg-slate-50 p-2.5 rounded text-slate-600">
                  <strong>Tutor Feedback:</strong> {prog.teacherFeedback}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 8: Follow-ups */}
      {activeTab === "followups" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Communication & Due Follow-up Queue
          </h3>
          <div className="divide-y divide-slate-100">
            {student.followUps.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active follow-ups logged for this student.
              </div>
            ) : (
              student.followUps.map((fol: any) => (
                <div key={fol.id} className="py-3.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Type: {fol.type} • Assigned: {fol.assignedStaff}
                    </span>
                    <span className="text-slate-400">
                      {formatInTimeZone(fol.contactDate, "Asia/Kolkata")}
                    </span>
                  </div>
                  {fol.outcome && <div><strong>Outcome:</strong> {fol.outcome}</div>}
                  {fol.parentResponse && <div className="text-slate-600"><strong>Parent Response:</strong> {fol.parentResponse}</div>}
                  {fol.notes && <div className="text-slate-500 italic">Notes: {fol.notes}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 9: Activity History */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Audit Trail & Event History
          </h3>
          <div className="text-xs text-slate-500 py-4 text-center">
            All credit ledger events and attendance submissions are cryptographically bound and timestamped in UTC.
          </div>
        </div>
      )}

      {/* Reallocate Modal */}
      {selectedForRealloc && (
        <ReallocateModal
          pkg={selectedForRealloc}
          onClose={() => setSelectedForRealloc(null)}
          onSuccess={() => {
            setSelectedForRealloc(null);
            router.refresh();
          }}
        />
      )}

      {/* Credit Ledger Modal */}
      {selectedForLedger && (
        <CreditLedgerModal
          packageId={selectedForLedger.id}
          packageNumber={selectedForLedger.number}
          packageName={selectedForLedger.name}
          onClose={() => setSelectedForLedger(null)}
        />
      )}
    </div>
  );
}
