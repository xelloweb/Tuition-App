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
  Layers,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Video,
  MessageCircle,
  ShieldAlert,
  Plus,
  AlertCircle,
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { daysPastDue, isPastDue } from "@/lib/billing";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { addDaysToLocalDate, localDateInZone, zonedTimeToUtc } from "@/lib/zoned-time";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

import { TeacherPortal } from "@/components/teachers/TeacherPortal";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  const showFinancial = canAccessFinancial(user.role);
  const isTeacher = user.role === "TEACHER" && Boolean(user.teacherId);

  const sp = await searchParams;
  const now = new Date();
  const todayIst = localDateInZone(now, BUSINESS_TIME_ZONE);
  const queryDateIst = sp.date || todayIst;
  
  const startOfDay = zonedTimeToUtc(queryDateIst, 0, BUSINESS_TIME_ZONE);
  const endOfDay = new Date(zonedTimeToUtc(addDaysToLocalDate(queryDateIst, 1), 0, BUSINESS_TIME_ZONE).getTime() - 1);

  // Filter queries based on role
  const sessionWhere: any = {
    scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay },
  };
  const missingWhere: any = {
    scheduledStartTimeUtc: { lt: now },
    status: "SCHEDULED",
  };

  if (isTeacher && user.teacherId) {
    sessionWhere.teacherId = user.teacherId;
    missingWhere.teacherId = user.teacherId;
  }

  // Today's sessions
  const todaysSessions = await prisma.session.findMany({
    where: sessionWhere,
    include: {
      student: true,
      teacher: true,
      subject: true,
      attendance: true,
      package: true,
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  if (isTeacher) {
    return (
      <TeacherPortal 
        teacherName={user.name} 
        sessions={todaysSessions as any} 
        currentDate={queryDateIst} 
      />
    );
  }

  // Next class and earnings for teacher
  let nextClass: any = null;
  let teacherStudentsCount = 0;
  let teacherTotalEarnings = 0;
  let teacherPendingEarnings = 0;

  if (isTeacher && user.teacherId) {
    nextClass = await prisma.session.findFirst({
      where: {
        teacherId: user.teacherId,
        scheduledStartTimeUtc: { gte: now },
        status: "SCHEDULED",
      },
      include: {
        student: true,
        subject: true,
      },
      orderBy: { scheduledStartTimeUtc: "asc" },
    });

    teacherStudentsCount = await prisma.subjectEnrollment.count({
      where: { teacherId: user.teacherId },
    });

    const teacherPayoutItems = await prisma.payoutItem.findMany({
      where: { teacherId: user.teacherId },
    });
    teacherTotalEarnings = teacherPayoutItems.reduce((acc, it) => acc + it.amount, 0);
    teacherPendingEarnings = teacherPayoutItems
      .filter((it) => it.status !== "PAID")
      .reduce((acc, it) => acc + it.amount, 0);
  }

  // Missing attendance count
  const missingAttendanceCount = await prisma.session.count({
    where: missingWhere,
  });

  // Teacher absences count (Admin & Coordinator)
  const teacherAbsencesCount = await prisma.attendanceRecord.count({
    where: { sessionOutcome: "TEACHER_NO_SHOW" },
  });

  // Active students
  const activeStudentsCount = await prisma.student.count({
    where: { status: "ACTIVE" },
  });

  // Low balance packages
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

  // Financial metrics (for accounts and admin)
  let netBilled = 0;
  let paymentsReceived = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let dueTodayCount = 0;
  let unverifiedPaymentsCount = 0;
  let promisedFollowUpsCount = 0;

  if (showFinancial) {
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" } },
    });

    for (const inv of invoices) {
      netBilled += inv.totalAmount;
      totalOutstanding += inv.balanceDue;
      if (inv.balanceDue > 0 && isPastDue(inv.dueDate, now)) {
        totalOverdue += inv.balanceDue;
      }
      if (inv.balanceDue > 0 && daysPastDue(inv.dueDate, now) === 0) {
        dueTodayCount++;
      }
    }

    const verifiedPayments = await prisma.payment.findMany({
      where: { isVerified: true },
    });
    paymentsReceived = verifiedPayments.reduce((acc, p) => acc + p.amount, 0);

    unverifiedPaymentsCount = await prisma.payment.count({
      where: { isVerified: false },
    });

    promisedFollowUpsCount = await prisma.followUp.count({
      where: { outcome: "PROMISED_PAYMENT" },
    });
  }

  return (
    <div className="space-y-6">
      {/* SaaS Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
              Operations Hub
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-medium text-slate-400">
              {formatInTimeZone(now, "Asia/Kolkata", "EEEE, dd MMM yyyy")} (IST)
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Welcome back, {user.name}
          </h2>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/timetable"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-850/80 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white shadow-md min-touch-target transition-all"
          >
            <Calendar className="h-4 w-4 text-teal-400" />
            <span>Schedule Session</span>
          </Link>
          <Link
            href="/attendance"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:from-teal-300 hover:to-emerald-400 shadow-lg shadow-teal-500/20 border border-teal-300/30 min-touch-target transition-all"
          >
            <Clock className="h-4 w-4" />
            <span>Attendance Inbox</span>
            {missingAttendanceCount > 0 && (
              <span className="rounded-full bg-slate-950 text-teal-300 px-2 py-0.2 text-[10px] font-bold">
                {missingAttendanceCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* "WHAT NEEDS ATTENTION NOW?" URGENT ACTION RIBBON */}
      {isTeacher ? (
        /* Teacher's Focus Banner */
        <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5 shadow-xl shadow-black/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Teacher Priority
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live updates
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextClass ? (
              <div className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-teal-400">
                    Next Upcoming Session
                  </span>
                  <div className="font-bold text-white text-sm">
                    {nextClass.student.name} • {nextClass.subject.name}
                  </div>
                  <div className="text-xs text-slate-300">
                    {formatInTimeZone(nextClass.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                  </div>
                  {nextClass.student.whatsappNumber && (
                    <div className="text-xs text-slate-300 font-medium pt-1">
                      <span className="text-slate-400 text-[11px]">WhatsApp:</span>{" "}
                      <strong className="text-white font-mono">{nextClass.student.whatsappNumber}</strong>
                    </div>
                  )}
                </div>
                {nextClass.student.whatsappNumber && (
                  <a
                    href={`https://wa.me/${nextClass.student.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      `Hello, greetings from Xello Tuition regarding ${nextClass.student.name}'s ${nextClass.subject.name} class.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 shrink-0 shadow-md transition-all"
                    title={`Chat with ${nextClass.student.name} on WhatsApp`}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                No pending upcoming classes scheduled for today.
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Attendance Pending
                </span>
                <div className="font-bold text-white text-sm mt-0.5">
                  {missingAttendanceCount} session(s) awaiting sign-off
                </div>
              </div>
              <Link
                href="/attendance"
                className="rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Open Inbox
              </Link>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-950/30 border border-teal-500/30">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400">
                  My Earnings
                </span>
                <div className="font-extrabold text-white text-base mt-0.5">
                  ₹{teacherTotalEarnings.toLocaleString("en-IN")} Total
                </div>
                <div className="text-[11px] text-teal-300/80 font-medium">
                  ₹{teacherPendingEarnings.toLocaleString("en-IN")} pending payout
                </div>
              </div>
              <Link
                href="/payouts"
                className="rounded-xl bg-teal-500 text-slate-950 px-3.5 py-1.5 text-xs font-black hover:bg-teal-400 shadow-md transition-all"
              >
                View Payouts
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Academic & Financial Attention Queue */
        (missingAttendanceCount > 0 ||
          teacherAbsencesCount > 0 ||
          lowBalancePackages.length > 0 ||
          unverifiedPaymentsCount > 0) && (
          <div className="rounded-2xl sm:rounded-3xl border border-amber-500/30 bg-amber-950/25 p-4 sm:p-5 shadow-xl shadow-black/40">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>What Needs Attention Now:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              {missingAttendanceCount > 0 && (
                <Link
                  href="/attendance"
                  className="rounded-xl bg-slate-900/80 p-3 border border-amber-500/30 hover:border-amber-400 transition-all block"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Pending Attendance
                  </span>
                  <div className="text-base font-black text-amber-400 mt-1">
                    {missingAttendanceCount} classes
                  </div>
                  <span className="text-[10px] text-slate-500">Past classes awaiting sign-off</span>
                </Link>
              )}

              {teacherAbsencesCount > 0 && (
                <Link
                  href="/attendance"
                  className="rounded-xl bg-slate-900/80 p-3 border border-rose-500/30 hover:border-rose-400 transition-all block"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Teacher Absences
                  </span>
                  <div className="text-base font-black text-rose-400 mt-1">
                    {teacherAbsencesCount} replacement needed
                  </div>
                  <span className="text-[10px] text-slate-500">Protected (0 credit deducted)</span>
                </Link>
              )}

              {lowBalancePackages.length > 0 && (
                <Link
                  href="/dues"
                  className="rounded-xl bg-slate-900/80 p-3 border border-teal-500/30 hover:border-teal-400 transition-all block"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Low Balances
                  </span>
                  <div className="text-base font-black text-teal-400 mt-1">
                    {lowBalancePackages.length} packages
                  </div>
                  <span className="text-[10px] text-slate-500">≤3 credits remaining</span>
                </Link>
              )}

              {showFinancial && unverifiedPaymentsCount > 0 && (
                <Link
                  href="/billing"
                  className="rounded-xl bg-slate-900/80 p-3 border border-blue-500/30 hover:border-blue-400 transition-all block"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Unverified Proofs
                  </span>
                  <div className="text-base font-black text-blue-400 mt-1">
                    {unverifiedPaymentsCount} payments
                  </div>
                  <span className="text-[10px] text-slate-500">Awaiting bank verification</span>
                </Link>
              )}
            </div>
          </div>
        )
      )}

      {/* KPI METRICS (COMPACT, ACTIONABLE, CLEAN SAAS) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isTeacher ? "My Teaching Operations" : "Operational Metrics"}
          </h3>
          <span className="text-[11px] text-slate-400">Real-time sync</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isTeacher ? (
            <>
              <MetricCard
                label="Today's Classes"
                value={todaysSessions.length}
                subtext="Scheduled for today"
                icon={CalendarCheck2}
                variant="teal"
                href="/timetable"
              />
              <MetricCard
                label="Assigned Students"
                value={teacherStudentsCount}
                subtext="Enrolled in subjects"
                icon={Users}
                variant="default"
                href="/students"
              />
              <MetricCard
                label="Pending Sign-Off"
                value={missingAttendanceCount}
                subtext="Past sessions to mark"
                icon={Clock}
                variant={missingAttendanceCount > 0 ? "warning" : "default"}
                href="/attendance"
              />
              <MetricCard
                label="My Total Earnings"
                value={`₹${teacherTotalEarnings.toLocaleString("en-IN")}`}
                subtext={`₹${teacherPendingEarnings.toLocaleString("en-IN")} pending payout`}
                icon={DollarSign}
                variant="teal"
                href="/payouts"
              />
            </>
          ) : (
            <>
              <MetricCard
                label="Active Students"
                value={activeStudentsCount}
                subtext="Kerala & GCC family enrollments"
                icon={Users}
                variant="teal"
                href="/students"
              />
              <MetricCard
                label="Today's Classes"
                value={todaysSessions.length}
                subtext="Sessions scheduled today"
                icon={CalendarCheck2}
                variant="default"
                href="/timetable"
              />
              <MetricCard
                label="Missing Attendance"
                value={missingAttendanceCount}
                subtext="Awaiting teacher completion"
                icon={Clock}
                variant={missingAttendanceCount > 0 ? "warning" : "default"}
                href="/attendance"
              />
              <MetricCard
                label="Low Balances"
                value={lowBalancePackages.length}
                subtext="≤3 credits remaining"
                icon={AlertTriangle}
                variant={lowBalancePackages.length > 0 ? "danger" : "default"}
                href="/dues"
              />
            </>
          )}
        </div>
      </div>

      {/* FINANCIAL OVERVIEW (IF FINANCIAL ACCESS) */}
      {showFinancial && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Financial & Collections Overview
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">INR (₹) Tabular</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Net Billed"
              value={`₹${netBilled.toLocaleString("en-IN")}`}
              subtext="Active generated invoices"
              icon={Receipt}
              variant="default"
              href="/billing"
            />
            <MetricCard
              label="Verified Collections"
              value={`₹${paymentsReceived.toLocaleString("en-IN")}`}
              subtext="Cleared bank payments"
              icon={CheckCircle2}
              variant="success"
              href="/billing"
            />
            <MetricCard
              label="Outstanding Total"
              value={`₹${totalOutstanding.toLocaleString("en-IN")}`}
              subtext="Unpaid invoice balance"
              icon={DollarSign}
              variant="default"
              href="/billing"
            />
            <MetricCard
              label="Overdue Balances"
              value={`₹${totalOverdue.toLocaleString("en-IN")}`}
              subtext={`${dueTodayCount} due today`}
              icon={AlertCircle}
              variant={totalOverdue > 0 ? "danger" : "default"}
              href="/dues"
            />
          </div>
        </div>
      )}

      {/* TODAY'S CLASS SCHEDULE FEED */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              Today&apos;s Class Schedule ({todaysSessions.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live sessions scheduled across India (IST) and GCC time zones
            </p>
          </div>
          <Link
            href="/timetable"
            className="text-xs font-bold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 min-touch-target transition-colors"
          >
            <span>Full Agenda</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-800/60">
          {todaysSessions.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <EmptyState
                icon={Calendar}
                title="No classes scheduled for today"
                description="Your schedule is clear. You can schedule new 1-on-1 or batch classes at any time."
                actionLabel="Schedule Session"
              />
            </div>
          ) : (
            todaysSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-2.5 h-10 rounded-full mt-0.5 shrink-0 shadow-sm"
                    style={{ backgroundColor: session.subject.color }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {session.student.name}
                      </span>
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        {session.student.grade}
                      </span>
                      <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                        {session.subject.name}
                      </span>
                      <StatusBadge status={session.status} size="sm" />
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Tutor: <strong className="text-slate-200">{session.teacher.name}</strong></span>
                      <span>•</span>
                      <span>
                        Student Zone: {session.student.timeZone} ({session.student.country})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-black text-white font-mono">
                      {formatInTimeZone(session.scheduledStartTimeUtc, "Asia/Kolkata")} IST
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatInTimeZone(
                        session.scheduledStartTimeUtc,
                        session.student.timeZone
                      )}{" "}
                      Local
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.student.whatsappNumber && (
                      <a
                        href={`https://wa.me/${session.student.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hello, this is regarding ${session.student.name}'s ${session.subject.name} class.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1.5 min-touch-target transition-all shadow-sm"
                        title={`WhatsApp ${session.student.name} (${session.student.whatsappNumber})`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}
                    {session.status === "SCHEDULED" && (
                      <Link
                        href="/attendance"
                        className="rounded-xl bg-teal-500 text-slate-950 px-3 py-1.5 text-xs font-black hover:bg-teal-400 min-touch-target flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Attendance
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
