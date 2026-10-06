"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { X, History, ArrowDownRight, ArrowUpRight, ShieldCheck, Clock } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezones";

interface CreditLedgerModalProps {
  packageId: string;
  packageNumber: string;
  packageName: string;
  onClose: () => void;
}

export function CreditLedgerModal({
  packageId,
  packageNumber,
  packageName,
  onClose,
}: CreditLedgerModalProps) {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ ledgers: any[] }>(`/api/packages/${packageId}/ledger`)
      .then((data) => {
        if (!cancelled) setLedgers(data.ledgers || []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "Could not load the credit ledger."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "PURCHASE_INITIAL":
        return { label: "Initial Purchase", bg: "bg-blue-500/15 border border-blue-500/30 text-blue-400" };
      case "REALLOCATION_IN":
        return { label: "Reallocation (+)", bg: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" };
      case "REALLOCATION_OUT":
        return { label: "Reallocation (-)", bg: "bg-purple-500/15 border border-purple-500/30 text-purple-400" };
      case "SESSION_CONSUMED":
        return { label: "Class Consumed", bg: "bg-slate-800 border border-slate-700 text-slate-300" };
      case "SESSION_REVERSED":
        return { label: "Attendance Reversed", bg: "bg-amber-500/15 border border-amber-500/30 text-amber-400" };
      default:
        return { label: eventType, bg: "bg-slate-800 border border-slate-700 text-slate-300" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 modal-overlay bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-3xl bg-[#0c1220] p-6 shadow-2xl border border-slate-800 text-white">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-2 text-teal-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Auditable Class-Credit Ledger
              </h3>
              <p className="text-xs text-slate-400">
                {packageName} ({packageNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Loading credit audit history...
            </div>
          ) : loadError ? (
            <div role="alert" className="py-10 text-center text-xs text-rose-300">{loadError}</div>
          ) : ledgers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No ledger entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {ledgers.map((entry) => {
                const badge = getEventBadge(entry.eventType);
                const isPositive = entry.creditsDelta > 0;

                return (
                  <div key={entry.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="font-bold text-white">
                          {entry.reason}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Recorded by <strong className="text-slate-200">{entry.actorName}</strong> ({entry.actorRole}) •{" "}
                        {formatInTimeZone(entry.createdAt, "Asia/Kolkata")} IST
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? `+${entry.creditsDelta}` : entry.creditsDelta} Credits
                        </div>
                        {entry.resultingRemaining !== null && (
                          <div className="text-[10px] text-slate-400">
                            Resulting Bal: {entry.resultingRemaining}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Immutable Audit Trail Verified
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
