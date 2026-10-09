"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  X,
  RefreshCw,
  Sparkles,
  GraduationCap,
  CalendarCheck2,
  Wallet,
} from "lucide-react";
import { errorMessage, readApiResponse } from "@/lib/client-api";
import { formatInTimeZone } from "@/lib/timezones";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PayoutReportForm } from "@/components/reports/PayoutReportForm";

interface PayoutsClientProps {
  payoutRuns: any[];
  unbatchedItems: any[];
  canManagePayouts: boolean;
  isTeacher?: boolean;
  teacherName?: string;
}

export function PayoutsClient({
  payoutRuns,
  unbatchedItems,
  canManagePayouts,
  isTeacher = false,
  teacherName,
}: PayoutsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreateRun = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/payouts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_RUN" }),
      });

      const data = await readApiResponse<any>(res, "Failed to create payout run");

      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (runId: string) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/payouts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MARK_PAID", runId }),
      });

      const data = await readApiResponse<any>(res, "Failed to mark run as paid");

      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const allRunItems = payoutRuns.flatMap((r) => r.items);
  const totalUnbatched = unbatchedItems.reduce((acc, it) => acc + it.amount, 0);

  // Teacher-specific aggregated metrics
  const totalLifetimeEarned =
    totalUnbatched + allRunItems.reduce((acc, it) => acc + it.amount, 0);
  const totalPaidOut = payoutRuns
    .filter((r) => r.status === "PAID")
    .flatMap((r) => r.items)
    .reduce((acc, it) => acc + it.amount, 0);
  const totalPendingPayout = totalLifetimeEarned - totalPaidOut;
  const totalCompletedClasses = unbatchedItems.length + allRunItems.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            {isTeacher ? (
              <GraduationCap className="h-4 w-4" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            <span>
              {isTeacher
                ? "Faculty Earnings & Payout Statements"
                : "Faculty Payroll & Earnings"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            {isTeacher ? "My earnings" : "Trainer payouts"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isTeacher
              ? `Welcome ${teacherName || ""}. Your earnings are calculated strictly from your completed classes and agreed standard-wise hourly rates.`
              : "Calculated strictly from approved completed classes with hourly rate snapshots. No session can appear in multiple runs."}
          </p>
        </div>

        {canManagePayouts && !isTeacher && unbatchedItems.length > 0 && (
          <button
            onClick={handleCreateRun}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-400 px-5 py-3 text-xs font-bold text-slate-950 hover:brightness-110 shrink-0 disabled:opacity-50 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            {loading ? "Creating..." : `Create Payout Run (${unbatchedItems.length} Sessions)`}
          </button>
        )}
      </div>

      {!isTeacher && (
        <div className="flex justify-end">
          <PayoutReportForm />
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-red-950/40 border border-red-500/30 p-4 text-xs text-red-300 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Teacher-Specific Summary Cards */}
      {isTeacher && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 sm:p-5 shadow-lg space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Total Lifetime Earned
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-teal-300">
              ₹{totalLifetimeEarned.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-teal-400/80">
              From all {totalCompletedClasses} completed classes
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 shadow-lg space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Pending Payout
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-amber-300">
              ₹{totalPendingPayout.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-amber-400/80">
              {unbatchedItems.length} class(es) awaiting batch processing
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 shadow-lg space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Paid Out to Bank
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-300">
              ₹{totalPaidOut.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-emerald-400/80">
              Transferred via verified payout runs
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-lg space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Classes Delivered
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {totalCompletedClasses}
            </div>
            <p className="text-xs text-slate-400">
              Sessions conducted & attendance verified
            </p>
          </div>
        </div>
      )}

      {/* Unbatched Pending Earnings Banner & Itemized Breakdown */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-400">
              {isTeacher
                ? "Conducted Classes Awaiting Payout Batch"
                : "Approved Sessions Awaiting Payout Run"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
              ₹{totalUnbatched.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {unbatchedItems.length} session(s) taught and verified with standard-specific hourly rates
            </p>
          </div>
          <div className="text-xs text-slate-400 max-w-sm rounded-2xl bg-slate-950/60 border border-slate-800 p-3">
            Rate snapshot rule: Each session records your agreed standard rate per hour at class completion time. Future rate changes do not alter already conducted sessions.
          </div>
        </div>

        {unbatchedItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No unbatched completed sessions pending right now.
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-slate-950/40">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Class-by-Class Earnings Breakdown ({unbatchedItems.length} Sessions)
            </span>
            <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-900/70 overflow-hidden text-xs">
              {unbatchedItems.map((item: any) => {
                const hours = (item.durationMinutes / 60).toFixed(1);
                const student = item.session?.student;
                const subject = item.session?.subject;
                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">
                          {item.teacher.name}
                        </span>
                        <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-xs font-semibold text-teal-300">
                          {subject?.name || "Subject"}
                        </span>
                        {student && (
                          <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-xs font-bold text-purple-300">
                            {student.name} • {student.grade}
                          </span>
                        )}
                        <StatusBadge status={item.status || "APPROVED"} size="sm" />
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                        <span>
                          Class Date: {formatInTimeZone(item.sessionDate, "Asia/Kolkata")}
                        </span>
                        <span>•</span>
                        <span>{item.notes || `${item.durationMinutes} mins class`}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <div className="text-xs text-slate-400 uppercase">Rate × Hours</div>
                        <div className="font-semibold text-slate-300">
                          ₹{item.rateSnapshot}/hr × {hours}h
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase">Earned</div>
                        <div className="text-base font-bold text-emerald-400">
                          ₹{item.amount.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payout Runs List */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800/80">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isTeacher ? "My Processed Payout Batches & History" : `Payout Batches & History (${payoutRuns.length})`}
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {payoutRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No payout batches processed yet.
            </div>
          ) : (
            payoutRuns.map((run) => {
              const runTeacherItems = isTeacher
                ? run.items.filter((it: any) => it.teacherId === unbatchedItems[0]?.teacherId || true)
                : run.items;
              const runTeacherTotal = isTeacher
                ? runTeacherItems.reduce((acc: number, it: any) => acc + it.amount, 0)
                : run.totalAmount;

              return (
                <div
                  key={run.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">
                        {run.runNumber}
                      </span>
                      <StatusBadge status={run.status} size="sm" />
                      <span className="text-slate-400 font-semibold">
                        {runTeacherItems.length} Sessions
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1">
                      Period: {formatInTimeZone(run.periodStart, "Asia/Kolkata")} to{" "}
                      {formatInTimeZone(run.periodEnd, "Asia/Kolkata")}
                    </div>
                    {run.approvedByName && (
                      <div className="text-xs text-teal-400 mt-0.5">
                        Approved by {run.approvedByName}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs uppercase text-slate-400">
                        {isTeacher ? "Your Payout" : "Total Payout"}
                      </span>
                      <div className="font-bold text-base text-white">
                        ₹{runTeacherTotal.toLocaleString("en-IN")}
                      </div>
                    </div>

                    {canManagePayouts && !isTeacher && run.status === "APPROVED" && (
                      <button
                        onClick={() => handleMarkPaid(run.id)}
                        disabled={loading}
                        className="min-h-[44px] rounded-xl bg-emerald-500 px-3.5 py-2 font-bold text-slate-950 hover:bg-emerald-400 text-sm shadow-md transition-all active:scale-95"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
