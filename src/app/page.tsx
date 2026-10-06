import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessFinancial } from "@/lib/auth";
import {
  Users,
  CalendarCheck2,
  Clock,
  AlertTriangle,
  Receipt,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const showFinancial = canAccessFinancial(user.role);

  // Academic metrics
  const activeStudentsCount = await prisma.student.count({
    where: { status: "ACTIVE" },
  });

  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Today's sessions
  const todaysSessions = await prisma.session.findMany({
    where: {
      scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      student: true,
      teacher: true,
      subject: true,
      attendance: true,
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  // Missing attendance: past sessions with status SCHEDULED
  const missingAttendanceCount = await prisma.session.count({
    where: {
      scheduledStartTimeUtc: { lt: now },
      status: "SCHEDULED",
    },
  });

  // Teacher absences
  const teacherAbsencesCount = await prisma.attendanceRecord.count({
    where: { sessionOutcome: "TEACHER_NO_SHOW" },
  });

  // Packages nearing exhaustion (< 3 credits remaining)
  const allPackages = await prisma.studentPackage.findMany({
    where: { status: "ACTIVE" },
    include: {
      sessions: { where: { isCreditConsumed: true } },
      student: true,
    },
  });

  const lowBalancePackages = allPackages.filter((pkg) => {
    const consumed = pkg.sessions.length;
    const remaining = pkg.totalCredits - consumed;
    return remaining > 0 && remaining <= 3;
  });

  // Financial metrics
  let netBilled = 0;
  let paymentsReceived = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let unverifiedPaymentsCount = 0;

  if (showFinancial) {
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" } },
    });

    for (const inv of invoices) {
      netBilled += inv.totalAmount;
      totalOutstanding += inv.balanceDue;
      if (inv.balanceDue > 0 && new Date(inv.dueDate) < now) {
        totalOverdue += inv.balanceDue;
      }
    }

    const verifiedPayments = await prisma.payment.findMany({
      where: { isVerified: true },
    });
    paymentsReceived = verifiedPayments.reduce((acc, p) => acc + p.amount, 0);

    unverifiedPaymentsCount = await prisma.payment.count({
      where: { isVerified: false },
    });
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-teal-500/20 px-2.5 py-1 text-xs font-semibold text-teal-200 uppercase tracking-wider">
                Active Persona: {user.role}
              </span>
              <span className="text-xs text-teal-200">
                • Kerala & GCC Academic Operations
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Welcome back, {user.name}
            </h2>
            <p className="mt-1 text-sm text-teal-100 max-w-2xl">
              Shared package balances, multi-subject reallocations, and dual-timezone scheduling engine for Kerala and GCC students.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
            >
              <Clock className="h-4 w-4" />
              Attendance Inbox ({missingAttendanceCount})
            </Link>
            <Link
              href="/packages"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-all shadow-sm"
            >
              <Layers className="h-4 w-4" />
              Manage Packages
            </Link>
          </div>
        </div>
      </div>

      {/* Academic Operational KPIs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Academic Operations
          </h3>
          <span className="text-xs text-slate-400">Real-time DB synced</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Active Students */}
          <Link
            href="/students"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-500 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Active Enrolled Students
              </span>
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {activeStudentsCount}
              </span>
              <span className="text-xs text-slate-500">in UAE, KSA & Kerala</span>
            </div>
          </Link>

          {/* Today's Sessions */}
          <Link
            href="/timetable"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-500 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Today's Sessions
              </span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {todaysSessions.length}
              </span>
              <span className="text-xs text-slate-500">classes scheduled</span>
            </div>
          </Link>

          {/* Missing Attendance */}
          <Link
            href="/attendance"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-amber-500 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Missing Attendance
              </span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-700">
                {missingAttendanceCount}
              </span>
              <span className="text-xs text-slate-500">pending teacher submission</span>
            </div>
          </Link>

          {/* Low Balances */}
          <Link
            href="/dues"
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-rose-500 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Low Balance Packages
              </span>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-700">
                {lowBalancePackages.length}
              </span>
              <span className="text-xs text-slate-500">≤3 classes remaining</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Financial KPIs (Conditional on Role) */}
      {showFinancial && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Financial Overview (Accounts & Admin)
            </h3>
            <span className="text-xs text-slate-400">Currency: INR</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/billing"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Net Billed (Active)
                </span>
                <Receipt className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                ₹{netBilled.toLocaleString("en-IN")}
              </div>
            </Link>

            <Link
              href="/billing"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Verified Collections
                </span>
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">
                ₹{paymentsReceived.toLocaleString("en-IN")}
              </div>
            </Link>

            <Link
              href="/billing"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Outstanding
                </span>
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </div>
            </Link>

            <Link
              href="/dues"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-red-400 hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Overdue Past Due Date
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  Action Required
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-700">
                ₹{totalOverdue.toLocaleString("en-IN")}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {unverifiedPaymentsCount} unverified payment proof(s) pending
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Today's Schedule & Low Balances */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Timetable Feed */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-slate-900">Today's Class Schedule</h4>
              <p className="text-xs text-slate-500">
                One-to-one sessions scheduled for today
              </p>
            </div>
            <Link
              href="/timetable"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              Full Timetable <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {todaysSessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No sessions scheduled for today.
              </div>
            ) : (
              todaysSessions.map((session) => (
                <div
                  key={session.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2.5 h-10 rounded-full mt-0.5 shrink-0"
                      style={{ backgroundColor: session.subject.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {session.student.name}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {session.student.grade}
                        </span>
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                          {session.subject.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Tutor: {session.teacher.name} • Student Zone:{" "}
                        {session.student.timeZone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-800">
                        {formatInTimeZone(session.scheduledStartTimeUtc, "Asia/Kolkata")}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatInTimeZone(session.scheduledStartTimeUtc, session.student.timeZone)} (Student Local)
                      </div>
                    </div>
                    {session.meetingUrl && (
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                      >
                        Join Class
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Essential Package Feature Callout & Low Balances */}
        <div className="space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-teal-600" />
              Shared Balance Mechanics
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Xello packages hold a <strong>shared balance</strong> across multiple subjects. 
              Academic coordinators can reallocate remaining classes between subjects (e.g. 10/10 to 15/5 during exams) with zero billing changes, atomic ledger audit trails, and automatic reservation conflict detection.
            </p>
            <div className="mt-4 pt-3 border-t border-teal-200/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-900">
                Try Reallocation
              </span>
              <Link
                href="/packages"
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
              >
                Go to Packages
              </Link>
            </div>
          </div>

          {/* Quick Expat Statistics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              GCC Expat & Kerala Demographics
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">🇦🇪 United Arab Emirates (Dubai/Sharjah)</span>
                <span className="font-semibold text-slate-900">GST (UTC+4)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">🇸🇦 Saudi Arabia (Riyadh/Jeddah)</span>
                <span className="font-semibold text-slate-900">AST (UTC+3)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">🇮🇳 Kerala, India</span>
                <span className="font-semibold text-slate-900">IST (UTC+5:30)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">🇶🇦 Qatar / 🇴🇲 Oman / 🇰🇼 Kuwait</span>
                <span className="font-semibold text-slate-900">Supported</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
