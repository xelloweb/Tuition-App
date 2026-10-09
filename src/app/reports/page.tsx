import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessFinancial } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PaymentReportForm } from "@/components/reports/PaymentReportForm";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  Layers,
  GraduationCap,
  DollarSign,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (user.role === "TEACHER") {
    return <AccessDenied message="Reports and exports are available to the owner, coordinators and Accounts staff." />;
  }
  const showFinancial = canAccessFinancial(user.role);

  // Subject attendance statistics
  const subjects = await prisma.subject.findMany({
    include: {
      sessions: {
        where: { isCreditConsumed: true },
      },
    },
  });

  // Package statistics
  const totalPackages = await prisma.studentPackage.count();
  const activePackages = await prisma.studentPackage.count({
    where: { status: "ACTIVE" },
  });

  // Total delivered vs consumed
  const totalSessionsDelivered = await prisma.session.count({
    where: { status: "COMPLETED" },
  });

  const totalCreditsConsumed = await prisma.session.count({
    where: { isCreditConsumed: true },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
          <BarChart3 className="h-4 w-4" />
          <span>Operational Intelligence & Audit Exports</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
          Reports & Permission-Controlled CSV Exports
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          All exports are automatically protected against spreadsheet formula injection (CSV Injection).
        </p>
      </div>

      {/* CSV Downloads Bar */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <FileSpreadsheet className="h-4 w-4 text-teal-400" />
          Downloadable Formula-Safe CSV Datasets
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Packages Export */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="font-bold text-white text-sm">
              Student Packages & Balances
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Full breakdown of total entitlement, consumed classes, remaining balance, and subject allocations.
            </p>
            <a
              href="/api/reports/export?type=packages"
              download
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 shadow-md text-sm transition-all active:scale-95"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Packages CSV
            </a>
          </div>

          {/* Attendance Export */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
            <div className="font-bold text-white text-sm">
              Attendance & Delivered Sessions
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Detailed session outcomes, topics taught, tutor names, and credit consumption flags.
            </p>
            <a
              href="/api/reports/export?type=attendance"
              download
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 shadow-md text-sm transition-all active:scale-95"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Attendance CSV
            </a>
          </div>

          {/* Collections Export (Financial) */}
          {showFinancial ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-3">
              <div className="font-bold text-white text-sm">
                Invoices & Collections Ledger
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Invoices, paid amounts, balance due, and overdue aging status.
              </p>
              <a
                href="/api/reports/export?type=collections"
                download
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 shadow-md text-sm transition-all active:scale-95"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Invoices CSV
              </a>
            </div>
            
            <PaymentReportForm />
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800/60 p-5 space-y-3 bg-slate-950/30">
              <div className="font-bold text-slate-400 text-sm">
                Collections & Invoices
              </div>
              <p className="text-slate-400 text-xs">
                Restricted: Financial exports require Accounts or Owner permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivered vs Consumed Comparison */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white">
            Delivered Classes vs Credits Consumed
          </h3>
          <p className="text-xs text-slate-400">
            Confirms strict accounting decoupling between physically delivered classes and policy-governed credit deductions.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2 text-center text-xs">
            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800">
              <span className="text-slate-400 uppercase tracking-wider text-xs font-bold">Classes Delivered</span>
              <div className="text-2xl font-bold text-white mt-1">
                {totalSessionsDelivered}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800">
              <span className="text-teal-400 uppercase tracking-wider text-xs font-bold">Credits Consumed</span>
              <div className="text-2xl font-bold text-teal-300 mt-1">
                {totalCreditsConsumed}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance by Subject Breakdown */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white">
            Classes Delivered by Subject
          </h3>
          <div className="divide-y divide-slate-800/80 text-xs">
            {subjects.map((sub) => (
              <div key={sub.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-slate-800"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="font-bold text-white">{sub.name}</span>
                </div>
                <span className="font-mono font-semibold text-slate-400">
                  {sub.sessions.length} sessions
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
