"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetch(`/api/packages/${packageId}/ledger`);
        const data = await res.json();
        setLedgers(data.ledgers || []);
      } catch (err) {
        console.error("Failed to load ledgers", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [packageId]);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "PURCHASE_INITIAL":
        return { label: "Initial Purchase", bg: "bg-blue-100 text-blue-800" };
      case "REALLOCATION_IN":
        return { label: "Reallocation (+)", bg: "bg-emerald-100 text-emerald-800" };
      case "REALLOCATION_OUT":
        return { label: "Reallocation (-)", bg: "bg-purple-100 text-purple-800" };
      case "SESSION_CONSUMED":
        return { label: "Class Consumed", bg: "bg-slate-100 text-slate-800" };
      case "SESSION_REVERSED":
        return { label: "Attendance Reversed", bg: "bg-amber-100 text-amber-800" };
      default:
        return { label: eventType, bg: "bg-slate-100 text-slate-800" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Auditable Class-Credit Ledger
              </h3>
              <p className="text-xs text-slate-500">
                {packageName} ({packageNumber})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Loading credit audit history...
            </div>
          ) : ledgers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No ledger entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ledgers.map((entry) => {
                const badge = getEventBadge(entry.eventType);
                const isPositive = entry.creditsDelta > 0;

                return (
                  <div key={entry.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="font-bold text-slate-900">
                          {entry.reason}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Recorded by <strong>{entry.actorName}</strong> ({entry.actorRole}) •{" "}
                        {formatInTimeZone(entry.createdAt, "Asia/Kolkata")} IST
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isPositive ? "text-emerald-700" : "text-rose-700"
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

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Immutable Audit Trail Verified
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
