import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Settings, Shield, Clock, Database, CheckCircle2, History } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";
import { AccessDenied } from "@/components/ui/AccessDenied";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (user.role !== "OWNER" && user.role !== "COORDINATOR") {
    return <AccessDenied message="Settings and the audit trail are available to the owner and academic coordinators." />;
  }

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
          <Settings className="h-4 w-4" />
          <span>System Policies & Compliance</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
          Settings & Operational Audit Trail
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure business rules, cancellation policies, and review the system audit log.
        </p>
      </div>

      {/* Policies Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-400" />
            Standard Tuition Policies
          </h3>
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-200">Cancellation Notice Period</span>
                <p className="text-slate-400 text-[11px]">Minimum advance notice to cancel without credit charge</p>
              </div>
              <span className="rounded-xl bg-teal-500/10 border border-teal-500/20 px-3 py-1 font-bold text-teal-300">
                4 Hours
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-200">Teacher Absence Policy</span>
                <p className="text-slate-400 text-[11px]">Teacher absence never deducts student package balance</p>
              </div>
              <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 font-bold text-emerald-300">
                Enforced (Zero Charge)
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-200">Student No-Show Policy</span>
                <p className="text-slate-400 text-[11px]">Unexcused absence deducts 1 credit per package rule</p>
              </div>
              <span className="rounded-xl bg-slate-800 border border-slate-700/60 px-3 py-1 font-bold text-slate-300">
                Chargeable
              </span>
            </div>
          </div>
        </div>

        {/* Database & Backup Instructions */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-400" />
            Database & Backup Readiness
          </h3>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              <strong className="text-white">Local Development:</strong> SQLite schema synced with <code className="text-teal-300">prisma/schema.prisma</code> at <code className="text-teal-300">dev.db</code>.
            </p>
            <p>
              <strong className="text-white">Production / Supabase:</strong> Configure <code className="text-teal-300">DATABASE_URL</code> with PostgreSQL pooling URL and <code className="text-teal-300">DIRECT_URL</code> for migrations.
            </p>
            <p>
              <strong className="text-white">Snapshot Backup Command:</strong>
              <code className="block bg-slate-950/80 p-3 rounded-xl mt-1.5 font-mono text-[11px] text-teal-300 border border-slate-800">
                sqlite3 dev.db &quot;.backup &apos;backup-$(date +%Y%m%d).db&apos;&quot;
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* System Audit Log Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <History className="h-4 w-4 text-teal-400" />
            System Audit Log (Last 50 Events)
          </span>
          <span className="text-xs text-slate-500">Cryptographically ordered</span>
        </div>

        <div className="divide-y divide-slate-800/80 text-xs">
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No audit records logged yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 sm:p-5 space-y-2 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-300">
                      {log.entityType}
                    </span>
                    <span className="font-bold text-white">
                      {log.action}
                    </span>
                    <span className="text-slate-400">
                      by <strong className="text-slate-200">{log.actorName}</strong> ({log.actorRole})
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-mono">
                    {formatInTimeZone(log.createdAt, "Asia/Kolkata")} IST
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-slate-800 overflow-x-auto">
                  {log.details}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
