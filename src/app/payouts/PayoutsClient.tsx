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
} from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

interface PayoutsClientProps {
  payoutRuns: any[];
  unbatchedItems: any[];
  canManagePayouts: boolean;
}

export function PayoutsClient({
  payoutRuns,
  unbatchedItems,
  canManagePayouts,
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create payout run");
      }

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark run as paid");
      }

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalUnbatched = unbatchedItems.reduce((acc, it) => acc + it.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <DollarSign className="h-4 w-4" />
            <span>Faculty Payroll & Earnings</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Teacher Payout Runs & Snapshots
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Calculated strictly from approved completed classes with hourly rate snapshots. No session can appear in multiple runs.
          </p>
        </div>

        {canManagePayouts && unbatchedItems.length > 0 && (
          <button
            onClick={handleCreateRun}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs shrink-0 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {loading ? "Creating..." : `Create Payout Run (${unbatchedItems.length} Sessions)`}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-100 p-3 text-xs text-red-800 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Unbatched Pending Earnings Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500">
            Approved Sessions Awaiting Payout Run
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₹{totalUnbatched.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {unbatchedItems.length} session(s) taught and verified
          </p>
        </div>
        <div className="text-xs text-slate-500 max-w-sm">
          Rate snapshot rule: Each session records the tutor's agreed rate per hour at class completion time. Future rate changes do not retroactively alter unpaid or completed sessions.
        </div>
      </div>

      {/* Payout Runs List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payout Batches & History ({payoutRuns.length})
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {payoutRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No payout runs created yet.
            </div>
          ) : (
            payoutRuns.map((run) => (
              <div
                key={run.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {run.runNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        run.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {run.status}
                    </span>
                    <span className="text-slate-600 font-semibold">
                      {run.totalSessions} Sessions
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">
                    Period: {formatInTimeZone(run.periodStart, "Asia/Kolkata")} to{" "}
                    {formatInTimeZone(run.periodEnd, "Asia/Kolkata")}
                  </div>
                  {run.approvedByName && (
                    <div className="text-[11px] text-teal-700 mt-0.5">
                      Approved by {run.approvedByName}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-400">Total Payout</span>
                    <div className="font-black text-base text-slate-900">
                      ₹{run.totalAmount.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {canManagePayouts && run.status === "APPROVED" && (
                    <button
                      onClick={() => handleMarkPaid(run.id)}
                      disabled={loading}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 text-xs shadow-2xs"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
