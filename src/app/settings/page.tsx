import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Settings, Shield, Clock, Database, CheckCircle2, History } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
          <Settings className="h-4 w-4" />
          <span>System Policies & Compliance</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
          Settings & Operational Audit Trail
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business rules, cancellation policies, and review tamper-evident system audit logs.
        </p>
      </div>

      {/* Policies Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" />
            Standard Tuition Policies
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-800">Cancellation Notice Period</span>
                <p className="text-slate-500 text-[11px]">Minimum advance notice to cancel without credit charge</p>
              </div>
              <span className="rounded-lg bg-teal-50 px-2.5 py-1 font-bold text-teal-700">
                4 Hours
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-800">Teacher Absence Policy</span>
                <p className="text-slate-500 text-[11px]">Teacher absence never deducts student package balance</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                Enforced (Zero Charge)
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-bold text-slate-800">Student No-Show Policy</span>
                <p className="text-slate-500 text-[11px]">Unexcused absence deducts 1 credit per package rule</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
                Chargeable
              </span>
            </div>
          </div>
        </div>

        {/* Database & Backup Instructions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-600" />
            Database & Backup Readiness
          </h3>
          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong>Local Development:</strong> SQLite schema synced with <code>prisma/schema.prisma</code> at <code>dev.db</code>.
            </p>
            <p>
              <strong>Production / Supabase:</strong> Configure <code>DATABASE_URL</code> with PostgreSQL pooling URL and <code>DIRECT_URL</code> for migrations.
            </p>
            <p>
              <strong>Snapshot Backup Command:</strong>
              <code className="block bg-slate-50 p-2 rounded mt-1 font-mono text-[11px] text-slate-800 border border-slate-200">
                sqlite3 dev.db ".backup 'backup-$(date +%Y%m%d).db'"
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* System Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <History className="h-4 w-4 text-teal-600" />
            System Audit Log (Last 50 Events)
          </span>
          <span className="text-xs text-slate-400">Cryptographically ordered</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No audit records logged yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      {log.entityType}
                    </span>
                    <span className="font-bold text-slate-900">
                      {log.action}
                    </span>
                    <span className="text-slate-500">
                      by <strong>{log.actorName}</strong> ({log.actorRole})
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    {formatInTimeZone(log.createdAt, "Asia/Kolkata")} IST
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
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
