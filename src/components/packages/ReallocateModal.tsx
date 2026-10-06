"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { PackageBalanceBreakdown } from "@/lib/types";

interface ReallocateModalProps {
  pkg: PackageBalanceBreakdown;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReallocateModal({ pkg, onClose, onSuccess }: ReallocateModalProps) {
  // Local state for allocations
  const [allocations, setAllocations] = useState<{ [subjectId: string]: number }>(() => {
    const initial: { [key: string]: number } = {};
    for (const sub of pkg.subjects) {
      initial[sub.subjectId] = sub.allocatedCredits;
    }
    return initial;
  });

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + Number(b || 0), 0);
  const unallocated = pkg.totalEntitlement - totalAllocated;

  // Real-time pre-validation
  useEffect(() => {
    const validate = async () => {
      setValidating(true);
      setErrorMessage("");
      try {
        const payload = {
          previewOnly: true,
          allocations: Object.entries(allocations).map(([subjectId, newAllocatedCredits]) => ({
            subjectId,
            newAllocatedCredits: Number(newAllocatedCredits) || 0,
          })),
          unallocatedCredits: Math.max(0, unallocated),
        };

        const res = await fetch(`/api/packages/${pkg.packageId}/reallocate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        setValidationResult(data);
      } catch (err: any) {
        console.error("Preview validation error", err);
      } finally {
        setValidating(false);
      }
    };

    const timer = setTimeout(validate, 250);
    return () => clearTimeout(timer);
  }, [allocations, unallocated, pkg.packageId]);

  const handleAllocationChange = (subjectId: string, val: number) => {
    setAllocations((prev) => ({
      ...prev,
      [subjectId]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage("Please enter a clear operational reason for this reallocation.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const payload = {
        previewOnly: false,
        reason,
        allocations: Object.entries(allocations).map(([subjectId, newAllocatedCredits]) => ({
          subjectId,
          newAllocatedCredits: Number(newAllocatedCredits) || 0,
        })),
        unallocatedCredits: Math.max(0, unallocated),
      };

      const res = await fetch(`/api/packages/${pkg.packageId}/reallocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reallocate package credits");
      }

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Reallocate Remaining Classes
            </h3>
            <p className="text-xs text-slate-500">
              Package: <span className="font-semibold text-slate-800">{pkg.packageName}</span> ({pkg.packageNumber})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Entitlement Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <div>
              <span className="text-xs text-slate-500">Total Entitlement</span>
              <div className="text-xl font-black text-slate-900">
                {pkg.totalEntitlement} Classes
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Already Consumed</span>
              <div className="text-xl font-bold text-slate-700">
                {pkg.totalConsumed} Classes
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Remaining to Allocate</span>
              <div className="text-xl font-bold text-teal-700">
                {pkg.totalRemaining} Classes
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Proposed Sum</span>
              <div
                className={`text-xl font-bold ${
                  totalAllocated === pkg.totalEntitlement
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {totalAllocated} / {pkg.totalEntitlement}
              </div>
            </div>
          </div>

          {/* Subject Allocations Inputs & Live Balance Preview */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Subject Class Allocations
            </h4>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {pkg.subjects.map((sub) => {
                const currentVal = allocations[sub.subjectId] ?? sub.allocatedCredits;
                const newRemaining = currentVal - sub.consumedCredits;

                return (
                  <div
                    key={sub.subjectId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: sub.subjectColor }}
                        />
                        <span className="font-bold text-slate-900 text-sm">
                          {sub.subjectName}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {sub.subjectCode}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 space-x-2">
                        <span>Consumed: <strong>{sub.consumedCredits}</strong></span>
                        <span>•</span>
                        <span>Reserved: <strong>{sub.reservedCredits}</strong></span>
                        <span>•</span>
                        <span>Original: <strong>{sub.allocatedCredits}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600 font-medium">
                          New:
                        </label>
                        <input
                          type="number"
                          min={sub.consumedCredits}
                          max={pkg.totalEntitlement}
                          value={currentVal}
                          onChange={(e) =>
                            handleAllocationChange(
                              sub.subjectId,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-900 text-center focus:border-teal-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="text-right min-w-[90px]">
                        <span className="text-[10px] text-slate-400 uppercase">
                          New Remaining
                        </span>
                        <div
                          className={`text-sm font-bold ${
                            newRemaining >= 0 ? "text-teal-700" : "text-red-700"
                          }`}
                        >
                          {newRemaining} Classes
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Errors & Conflict Warnings */}
          {validationResult && !validationResult.valid && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Validation Constraints Blocked
              </div>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              {validationResult.affectedSessions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <span className="font-semibold">Conflicting Scheduled Sessions:</span>
                  <ul className="mt-1 space-y-0.5 text-[11px]">
                    {validationResult.affectedSessions.map((s: any, idx: number) => (
                      <li key={idx}>
                        • {s.subjectName} with {s.teacherName} (ID: {s.sessionId})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Success Validation Preview */}
          {validationResult && validationResult.valid && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Valid allocation configuration. Sum matches {pkg.totalEntitlement} classes and all future reservations are satisfied.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-red-100 p-3 text-xs text-red-800 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Reason input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Operational Reason (Audited) *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student requested Chemistry boost for upcoming CBSE term exams"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-hidden"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Reason will be permanently recorded in the auditable class-credit ledger along with your username and timestamp.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (validationResult && !validationResult.valid)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Recording Reallocation...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Confirm & Audit Reallocation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
