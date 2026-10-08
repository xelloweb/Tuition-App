import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Plus, Receipt, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { countUnreadSubmissions } from "@/lib/services/parent-submissions";
import { studentsNeedingPackageSetup } from "@/lib/services/existing-payment-packages";
import { canAccessFinancial, canManageStudents, getCurrentUser, isUnlinkedTrainer, UNLINKED_TRAINER_MESSAGE, canAssignExistingPayments } from "@/lib/auth";
import { calculateFinancialSummary } from "@/lib/billing";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { formatDateOnly, formatTimeOnly } from "@/lib/timezones";
import { addDaysToLocalDate, localDateInZone, zonedTimeToUtc } from "@/lib/zoned-time";
import { TeacherPortal } from "@/components/teachers/TeacherPortal";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const LOW_BALANCE = 3;
const LIST_LIMIT = 8;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const whatsappLink = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function AttentionCard({ href, count, title, detail, tone = "warning" }: { href: string; count: number; title: string; detail: string; tone?: "warning" | "danger" | "info" }) {
  const toneClass = tone === "danger" ? "border-rose-400/50" : tone === "info" ? "border-sky-300/40" : "border-amber-300/50";
  return (
    <li>
      <Link href={href} className={`flex h-full flex-col justify-between gap-2 rounded-card border bg-surface p-4 hover:bg-raised ${toneClass}`}>
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-2xl font-bold tabular-nums text-ink">{count}</span>
        <span className="flex items-end justify-between gap-2 text-sm text-ink-muted">
          {detail}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function RecordList<T>({ id, title, description, items, more, moreHref, render }: { id: string; title: string; description: string; items: T[]; more: number; moreHref: string; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 rounded-card border border-line bg-surface p-4">
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-ink-muted">{description}</p>
      <ul className="mt-3 divide-y divide-line">{items.map(render)}</ul>
      {more > 0 && (
        <Link href={moreHref} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-text">
          {more} more <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function MoneyCard({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <li>
      <Link href={href} className="flex h-full flex-col gap-1 rounded-card border border-line bg-surface p-4 hover:bg-raised">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        <span className="text-xl font-bold tabular-nums text-ink">{value}</span>
        <span className="text-sm text-ink-subtle">{detail}</span>
      </Link>
    </li>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (isUnlinkedTrainer(user)) return <AccessDenied message={UNLINKED_TRAINER_MESSAGE} />;

  const sp = await searchParams;
  const now = new Date();
  const todayIst = localDateInZone(now, BUSINESS_TIME_ZONE);

  // ---- Trainer workspace: their own classes for the chosen IST date ----
  if (user.role === "TEACHER") {
    const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIst;
    const from = zonedTimeToUtc(date, 0, BUSINESS_TIME_ZONE);
    const to = zonedTimeToUtc(addDaysToLocalDate(date, 1), 0, BUSINESS_TIME_ZONE);
    const [sessions, pendingCount] = await Promise.all([
      prisma.session.findMany({
        where: { teacherId: user.teacherId!, scheduledStartTimeUtc: { gte: from, lt: to } },
        include: { student: true, subject: true, attendance: true },
        orderBy: { scheduledStartTimeUtc: "asc" },
      }),
      prisma.session.count({ where: { teacherId: user.teacherId!, status: "SCHEDULED", scheduledStartTimeUtc: { lt: now } } }),
    ]);
    return <TeacherPortal teacherName={user.name} sessions={sessions} currentDate={date} todayDate={todayIst} pendingCount={pendingCount} />;
  }

  // ---- Staff workspaces ----
  const academic = canManageStudents(user.role); // owner, coordinator
  const financial = canAccessFinancial(user.role); // owner, accounts
  const dayStart = zonedTimeToUtc(todayIst, 0, BUSINESS_TIME_ZONE);
  const dayEnd = zonedTimeToUtc(addDaysToLocalDate(todayIst, 1), 0, BUSINESS_TIME_ZONE);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const none = Promise.resolve(null);

  const [todaysSessions, pendingAttendance, activePackages, drafts, newSubmissions, paidNotSetUp, noTrainer, noSchedule, absences, overdueCount, unverifiedPayments, finance] = await Promise.all([
    academic
      ? prisma.session.findMany({
          where: { scheduledStartTimeUtc: { gte: dayStart, lt: dayEnd } },
          include: { student: true, teacher: true, subject: true },
          orderBy: { scheduledStartTimeUtc: "asc" },
        })
      : none,
    academic ? prisma.session.count({ where: { status: "SCHEDULED", scheduledStartTimeUtc: { lt: now } } }) : none,
    academic
      ? prisma.studentPackage.findMany({ where: { status: "ACTIVE" }, select: { id: true, packageNumber: true, totalCredits: true, studentId: true, student: { select: { name: true } } } })
      : none,
    academic ? prisma.admissionDraft.count() : none,
    academic ? countUnreadSubmissions() : none,
    canAssignExistingPayments(user.role) ? studentsNeedingPackageSetup().then((list) => list.length) : none,
    academic
      ? prisma.subjectEnrollment.findMany({
          where: { status: "ACTIVE", teacherId: null, student: { status: "ACTIVE" } },
          select: { id: true, studentId: true, student: { select: { name: true } }, subject: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : none,
    academic
      ? prisma.subjectEnrollment.findMany({
          where: { status: "ACTIVE", teacherId: { not: null }, student: { status: "ACTIVE" }, timetableSlots: { none: { active: true } } },
          select: { id: true, studentId: true, student: { select: { name: true } }, subject: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : none,
    academic
      ? prisma.attendanceRecord.findMany({
          where: { sessionOutcome: "TEACHER_NO_SHOW", session: { scheduledStartTimeUtc: { gte: thirtyDaysAgo } } },
          select: { id: true, session: { select: { scheduledStartTimeUtc: true, studentId: true, student: { select: { name: true } }, teacher: { select: { name: true } }, subject: { select: { name: true } } } } },
          orderBy: { markedAt: "desc" },
        })
      : none,
    // Coordinators follow up dues with parents, so they see how many invoices are overdue.
    academic && !financial ? calculateFinancialSummary(now).then((f) => f.overdueInvoices) : none,
    financial ? prisma.payment.count({ where: { isVerified: false } }) : none,
    financial ? calculateFinancialSummary(now) : none,
  ]);

  // Classes left = total − consumed (same rule as the package ledger); reserved classes are listed too.
  let lowPackages: { id: string; packageNumber: string; studentId: string; studentName: string; left: number; booked: number }[] = [];
  if (activePackages && activePackages.length) {
    const ids = activePackages.map((p) => p.id);
    const [consumed, reserved] = await Promise.all([
      prisma.session.groupBy({ by: ["packageId"], where: { packageId: { in: ids }, isCreditConsumed: true }, _count: { _all: true } }),
      prisma.session.groupBy({ by: ["packageId"], where: { packageId: { in: ids }, isCreditConsumed: false, isCreditReserved: true, status: "SCHEDULED" }, _count: { _all: true } }),
    ]);
    const usedBy = new Map(consumed.map((c) => [c.packageId, c._count._all]));
    const bookedBy = new Map(reserved.map((r) => [r.packageId, r._count._all]));
    lowPackages = activePackages
      .map((p) => ({ id: p.id, packageNumber: p.packageNumber, studentId: p.studentId, studentName: p.student.name, left: p.totalCredits - (usedBy.get(p.id) ?? 0), booked: bookedBy.get(p.id) ?? 0 }))
      .filter((p) => p.left <= LOW_BALANCE)
      .sort((a, b) => a.left - b.left);
  }

  const dateLabel = formatDateOnly(now);
  const attention: React.ComponentProps<typeof AttentionCard>[] = [];
  if (pendingAttendance) attention.push({ href: "/attendance", count: pendingAttendance, title: "Attendance not marked", detail: "Past classes still waiting for attendance", tone: "danger" });
  if (lowPackages.length) attention.push({ href: "#low-packages", count: lowPackages.length, title: "Packages running low", detail: `${LOW_BALANCE} or fewer classes left, including used up` });
  if (noTrainer?.length) attention.push({ href: "#no-trainer", count: noTrainer.length, title: "Subjects without a trainer", detail: "Classes cannot be booked yet" });
  if (noSchedule?.length) attention.push({ href: "#no-schedule", count: noSchedule.length, title: "Subjects without a weekly schedule", detail: "Trainer assigned, no weekly slots" });
  if (absences?.length) attention.push({ href: "#trainer-absences", count: absences.length, title: "Trainer absences (30 days)", detail: "Check replacement classes", tone: "info" });
  if (paidNotSetUp) attention.push({ href: "/packages#paid-not-set-up", count: paidNotSetUp, title: "Paid, package not set up", detail: "Assign packages using the existing payments" });
  if (newSubmissions) attention.push({ href: "/admissions", count: newSubmissions, title: "New parent submissions", detail: "Parent form answers nobody has opened yet" });
  if (drafts) attention.push({ href: "/students", count: drafts, title: "Admission drafts", detail: "Unfinished admissions to complete", tone: "info" });
  if (unverifiedPayments) attention.push({ href: "/billing", count: unverifiedPayments, title: "Payments to verify", detail: "Recorded, not yet checked against the bank" });
  if (finance?.overdueInvoices) attention.push({ href: "/dues", count: finance.overdueInvoices, title: "Overdue invoices", detail: `${inr(finance.overdue)} past the due date`, tone: "danger" });
  if (overdueCount) attention.push({ href: "/dues", count: overdueCount, title: "Overdue invoices", detail: "Parents to follow up", tone: "danger" });

  const description =
    user.role === "ACCOUNTS"
      ? "Payments to verify and balances to collect."
      : user.role === "COORDINATOR"
        ? "Today's classes and the work that needs your attention."
        : "Today's classes, items needing attention and the money position.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        context={`${dateLabel} · IST`}
        description={description}
        actions={
          <>
            {academic && (
              <Link href="/students?admit=1" className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-brand-ink hover:bg-brand-hover">
                <Plus className="h-4 w-4" aria-hidden="true" /> Admit a student
              </Link>
            )}
            {financial && (
              <Link href="/billing" className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-raised">
                <Receipt className="h-4 w-4" aria-hidden="true" /> Invoices & payments
              </Link>
            )}
          </>
        }
      />

      <section aria-labelledby="attention-heading" className="space-y-3">
        <h2 id="attention-heading" className="text-lg font-semibold text-ink">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-sm text-ink-muted">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" /> Nothing needs attention right now.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((a) => (
              <AttentionCard key={a.title} {...a} />
            ))}
          </ul>
        )}
      </section>

      {todaysSessions && (
        <section aria-labelledby="today-heading" className="rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
            <div>
              <h2 id="today-heading" className="text-lg font-semibold text-ink">Today&apos;s classes ({todaysSessions.length})</h2>
              <p className="text-sm text-ink-muted">{dateLabel}, times in IST</p>
            </div>
            <Link href="/timetable" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-text">
              Full timetable <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {todaysSessions.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-ink-muted">
              <CalendarClock className="h-5 w-5" aria-hidden="true" /> No classes today.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todaysSessions.map((s) => (
                <li key={s.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <p className="w-20 shrink-0 font-semibold tabular-nums text-ink">{formatTimeOnly(s.scheduledStartTimeUtc)}</p>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink break-words">
                        <Link href={`/students/${s.studentId}`} className="hover:underline">{s.student.name}</Link>
                        <span className="font-normal text-ink-muted"> · {s.subject.name} · {s.student.grade}</span>
                      </p>
                      <p className="text-sm text-ink-muted">Trainer: {s.teacher.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.status} size="sm" />
                    {s.student.whatsappNumber && (
                      <a
                        href={whatsappLink(s.student.whatsappNumber, `Hello, this is Xello Tuition about ${s.student.name}'s ${s.subject.name} class today.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp<span className="sr-only"> {s.student.name}&apos;s parent</span>
                      </a>
                    )}
                    {s.status === "SCHEDULED" && (
                      <Link href={`/attendance?session=${s.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control bg-brand px-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover">
                        <ClipboardList className="h-4 w-4" aria-hidden="true" /> Attendance<span className="sr-only"> for {s.student.name}</span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {finance && (
        <section aria-labelledby="money-heading" className="space-y-3">
          <div>
            <h2 id="money-heading" className="text-lg font-semibold text-ink">Money (INR)</h2>
            <p className="text-sm text-ink-muted">Balances as of {dateLabel}. Billed and received are all-time totals.</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MoneyCard label="Billed" value={inr(finance.billed)} detail="All invoices, all time" href="/billing" />
            <MoneyCard label="Received (verified)" value={inr(finance.received)} detail="Checked payments, all time" href="/billing" />
            <MoneyCard label="Outstanding" value={inr(finance.outstanding)} detail="Unpaid balance today" href="/dues" />
            <MoneyCard label="Overdue" value={inr(finance.overdue)} detail={`${finance.overdueInvoices} invoice${finance.overdueInvoices === 1 ? "" : "s"} past due · ${finance.dueToday} due today`} href="/dues" />
            <MoneyCard label="Advance" value={inr(finance.advance)} detail="Verified, not yet allocated" href="/billing" />
          </ul>
        </section>
      )}

      <RecordList
        id="low-packages"
        title="Packages running low"
        description={`Active packages with ${LOW_BALANCE} or fewer classes left (classes left = purchased − taken).`}
        items={lowPackages.slice(0, LIST_LIMIT)}
        more={Math.max(0, lowPackages.length - LIST_LIMIT)}
        moreHref="/packages"
        render={(p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <Link href={`/students/${p.studentId}`} className="min-h-[44px] content-center font-semibold text-ink hover:underline">
              {p.studentName} <span className="font-normal text-ink-subtle">· {p.packageNumber}</span>
            </Link>
            <span className={`text-sm tabular-nums ${p.left <= 0 ? "font-semibold text-danger" : "text-warning"}`}>
              {p.left <= 0 ? "Used up" : `${p.left} left`}
              {p.booked > 0 ? ` · ${p.booked} booked` : ""}
            </span>
          </li>
        )}
      />
      <RecordList
        id="no-trainer"
        title="Subjects without a trainer"
        description="Assign a trainer on the student's profile so classes can be booked."
        items={(noTrainer ?? []).slice(0, LIST_LIMIT)}
        more={Math.max(0, (noTrainer?.length ?? 0) - LIST_LIMIT)}
        moreHref="/students"
        render={(e) => (
          <li key={e.id} className="py-2.5">
            <Link href={`/students/${e.studentId}`} className="inline-flex min-h-[44px] items-center gap-2 text-ink hover:underline">
              <UserX className="h-4 w-4 text-warning" aria-hidden="true" /> {e.student.name} <span className="text-ink-subtle">· {e.subject.name}</span>
            </Link>
          </li>
        )}
      />
      <RecordList
        id="no-schedule"
        title="Subjects without a weekly schedule"
        description="A trainer is assigned but no weekly slots exist, so nothing gets booked."
        items={(noSchedule ?? []).slice(0, LIST_LIMIT)}
        more={Math.max(0, (noSchedule?.length ?? 0) - LIST_LIMIT)}
        moreHref="/students"
        render={(e) => (
          <li key={e.id} className="py-2.5">
            <Link href={`/students/${e.studentId}#timetable`} className="inline-flex min-h-[44px] items-center gap-2 text-ink hover:underline">
              <CalendarClock className="h-4 w-4 text-warning" aria-hidden="true" /> {e.student.name} <span className="text-ink-subtle">· {e.subject.name}</span>
            </Link>
          </li>
        )}
      />
      <RecordList
        id="trainer-absences"
        title="Trainer absences in the last 30 days"
        description="No class credit was used for these. Arrange replacement classes from the student's timetable."
        items={(absences ?? []).slice(0, LIST_LIMIT)}
        more={Math.max(0, (absences?.length ?? 0) - LIST_LIMIT)}
        moreHref="/attendance"
        render={(a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <Link href={`/students/${a.session.studentId}`} className="min-h-[44px] content-center text-ink hover:underline">
              {a.session.student.name} · {a.session.subject.name}
            </Link>
            <span className="text-ink-muted">
              {formatDateOnly(a.session.scheduledStartTimeUtc)} · {a.session.teacher.name}
            </span>
          </li>
        )}
      />
      {!academic && !financial && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> Your role has no dashboard items yet.
        </p>
      )}
    </div>
  );
}
