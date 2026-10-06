import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessFinancial } from "@/lib/auth";
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

export default async function ReportsPage() {
  const user = await getCurrentUser();
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
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
          <BarChart3 className="h-4 w-4" />
          <span>Operational Intelligence & Audit Exports</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Reports & Permission-Controlled CSV Exports
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          All exports are automatically protected against spreadsheet formula injection (CSV Injection).
        </p>
      </div>

      {/* CSV Downloads Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileSpreadsheet className="h-4 w-4 text-teal-600" />
          Downloadable Formula-Safe CSV Datasets
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Packages Export */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="font-bold text-slate-900">
              Student Packages & Balances
            </div>
            <p className="text-slate-500 text-[11px]">
              Full breakdown of total entitlement, consumed classes, remaining balance, and subject allocations.
            </p>
            <a
              href="/api/reports/export?type=packages"
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 font-bold text-white hover:bg-teal-700 shadow-2xs text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Packages CSV
            </a>
          </div>

          {/* Attendance Export */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="font-bold text-slate-900">
              Attendance & Delivered Sessions
            </div>
            <p className="text-slate-500 text-[11px]">
              Detailed session outcomes, topics taught, tutor names, and credit consumption flags.
            </p>
            <a
              href="/api/reports/export?type=attendance"
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 font-bold text-white hover:bg-teal-700 shadow-2xs text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Attendance CSV
            </a>
          </div>

          {/* Collections Export (Financial) */}
          {showFinancial ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
              <div className="font-bold text-slate-900">
                Invoices & Collections Ledger
              </div>
              <p className="text-slate-500 text-[11px]">
                Invoices, paid amounts, balance due, and overdue aging status.
              </p>
              <a
                href="/api/reports/export?type=collections"
                download
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 font-bold text-white hover:bg-teal-700 shadow-2xs text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Download Invoices CSV
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50">
              <div className="font-bold text-slate-500">
                Collections & Invoices
              </div>
              <p className="text-slate-400 text-[11px]">
                Restricted: Financial exports require Accounts or Owner permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Delivered vs Consumed Comparison */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            Delivered Classes vs Credits Consumed
          </h3>
          <p className="text-xs text-slate-500">
            Confirms strict accounting decoupling between physically delivered classes and policy-governed credit deductions.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2 text-center text-xs">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-slate-500">Classes Delivered</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {totalSessionsDelivered}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-slate-500">Credits Consumed</span>
              <div className="text-2xl font-black text-teal-700 mt-1">
                {totalCreditsConsumed}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance by Subject Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">
            Classes Delivered by Subject
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {subjects.map((sub) => (
              <div key={sub.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="font-bold text-slate-900">{sub.name}</span>
                </div>
                <span className="font-semibold text-slate-700">
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
