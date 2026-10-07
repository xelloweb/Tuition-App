"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  Minus,
  ArrowRightLeft,
  Sparkles,
} from "lucide-react";
import { errorMessage as toErrorMessage, readApiResponse } from "@/lib/client-api";
import { PackageBalanceBreakdown } from "@/lib/types";
import { Button } from "@/components/ui/Button";

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

  // Transfer helper state (quick transfer between 2 subjects)
  const [transferFrom, setTransferFrom] = useState(pkg.subjects[0]?.subjectId || "");
  const [transferTo, setTransferTo] = useState(pkg.subjects[1]?.subjectId || "");
  const [transferCount, setTransferCount] = useState(1);

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

        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !Array.isArray(data.errors)) {
          setValidationResult(null);
          setErrorMessage(data?.error || "Could not check this reallocation. Try again.");
          return;
        }
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
      [subjectId]: Math.max(0, val),
    }));
  };

  const handleIncrement = (subjectId: string) => {
    setAllocations((prev) => ({
      ...prev,
      [subjectId]: (prev[subjectId] || 0) + 1,
    }));
  };

  const handleDecrement = (subjectId: string, minAllowed: number) => {
    setAllocations((prev) => {
      const current = prev[subjectId] || 0;
      if (current <= minAllowed) return prev;
      return {
        ...prev,
        [subjectId]: current - 1,
      };
    });
  };

  const handleApplyTransfer = () => {
    if (!transferFrom || !transferTo || transferFrom === transferTo || transferCount <= 0) return;
    const fromSub = pkg.subjects.find((s) => s.subjectId === transferFrom);
    const minFromAllowed = (fromSub?.consumedCredits || 0) + (fromSub?.reservedCredits || 0);
    const currentFrom = allocations[transferFrom] || 0;

    if (currentFrom - transferCount < minFromAllowed) {
      setErrorMessage(
        `Cannot transfer ${transferCount} classes: would violate consumed (${fromSub?.consumedCredits}) or reserved (${fromSub?.reservedCredits}) classes.`
      );
      return;
    }

    setAllocations((prev) => ({
      ...prev,
      [transferFrom]: (prev[transferFrom] || 0) - transferCount,
      [transferTo]: (prev[transferTo] || 0) + transferCount,
    }));
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage("Please enter an operational reason for this reallocation.");
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

      const data = await readApiResponse<any>(res, "Failed to reallocate package credits");

      onSuccess();
    } catch (err: any) {
      setErrorMessage(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell labelledBy="reallocate-title" onClose={onClose} maxWidth="max-w-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 id="reallocate-title" className="text-base sm:text-lg font-bold text-white">
              Reallocate Remaining Classes
            </h2>
            <p className="text-xs text-slate-400">
              Package: <span className="font-semibold text-teal-400">{pkg.packageName}</span> ({pkg.packageNumber})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white min-touch-target flex items-center justify-center transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5 text-xs">
          {/* PACKAGE METRICS SUMMARY BANNER */}
          <div className="rounded-2xl bg-slate-900/80 p-4 border border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Total Package</span>
                <span className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums">
                  {pkg.totalEntitlement}
                </span>
                <span className="text-xs text-slate-400 block">Entitlement</span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Consumed</span>
                <span className="text-lg sm:text-xl font-bold text-slate-300 font-mono tabular-nums">
                  {pkg.totalConsumed}
                </span>
                <span className="text-xs text-slate-400 block">Taught & Locked</span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Remaining</span>
                <span className="text-lg sm:text-xl font-bold text-teal-400 font-mono tabular-nums">
                  {pkg.totalRemaining}
                </span>
                <span className="text-xs text-slate-400 block">Unused Credits</span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Proposed Sum</span>
                <span
                  className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${
                    totalAllocated === pkg.totalEntitlement ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {totalAllocated} / {pkg.totalEntitlement}
                </span>
                <span className="text-xs text-slate-400 block">
                  {totalAllocated === pkg.totalEntitlement ? "Balanced" : `${pkg.totalEntitlement - totalAllocated} unallocated`}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400 text-center border-t border-slate-800 pt-2">
              Remaining credits are flexible across enrolled subjects. Total package classes remain fixed.
            </p>
          </div>

          {/* STEP 2 & 3: QUICK TRANSFER TOOL */}
          {pkg.subjects.length >= 2 && (
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-teal-400 text-xs">
                <ArrowRightLeft className="h-4 w-4 text-teal-400" />
                <span>Quick Transfer Between Subjects:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div className="sm:col-span-1">
                  <label htmlFor="reallocatemodal-field-1" className="text-xs uppercase font-bold text-slate-400 block mb-0.5">Transfer From</label>
                  <select id="reallocatemodal-field-1"
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 font-semibold text-white text-xs focus:outline-hidden focus:border-teal-500"
                  >
                    {pkg.subjects.map((s) => (
                      <option key={s.subjectId} value={s.subjectId}>
                        {s.subjectName} (Avail: {Math.max(0, (allocations[s.subjectId] || 0) - s.consumedCredits - s.reservedCredits)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="reallocatemodal-field-2" className="text-xs uppercase font-bold text-slate-400 block mb-0.5">Transfer To</label>
                  <select id="reallocatemodal-field-2"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 font-semibold text-white text-xs focus:outline-hidden focus:border-teal-500"
                  >
                    {pkg.subjects.map((s) => (
                      <option key={s.subjectId} value={s.subjectId}>
                        {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <p id="transfer-count-label" className="text-xs uppercase font-bold text-slate-400 block mb-0.5">Classes count</p>
                  <div className="flex items-center gap-1" role="group" aria-labelledby="transfer-count-label">
                    {[1, 2, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTransferCount(cnt)}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                          transferCount === cnt
                            ? "bg-teal-500 text-slate-950"
                            : "bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                        }`}
                      >
                        +{cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-1 pt-3 sm:pt-0">
                  <button
                    type="button"
                    onClick={handleApplyTransfer}
                    className="w-full rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-all active:scale-95"
                  >
                    Apply Transfer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: SUBJECT-BY-SUBJECT ALLOCATION CONTROLS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Detailed Subject Credit Allocations
            </h4>

            <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              {pkg.subjects.map((sub) => {
                const currentVal = allocations[sub.subjectId] ?? sub.allocatedCredits;
                const minAllowed = sub.consumedCredits;
                const newRemaining = currentVal - sub.consumedCredits;
                const availableToSchedule = Math.max(0, newRemaining - sub.reservedCredits);

                return (
                  <div
                    key={sub.subjectId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: sub.subjectColor }}
                        />
                        <span className="font-bold text-white text-sm">
                          {sub.subjectName}
                        </span>
                        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
                          {sub.subjectCode}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                        <span>Consumed: <strong className="text-slate-200">{sub.consumedCredits}</strong></span>
                        <span>•</span>
                        <span>Reserved: <strong className="text-slate-200">{sub.reservedCredits}</strong></span>
                        <span>•</span>
                        <span>
                          Available to Schedule: <strong className="text-teal-400">{availableToSchedule}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Numeric Input + Increment/Decrement Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecrement(sub.subjectId, minAllowed)}
                          disabled={currentVal <= minAllowed}
                          className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Decrease ${sub.subjectName} credits`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <input
                          type="number"
                          min={minAllowed}
                          max={pkg.totalEntitlement}
                          value={currentVal}
                          onChange={(e) =>
                            handleAllocationChange(
                              sub.subjectId,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 h-9 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-sm font-bold text-white text-center font-mono tabular-nums focus:border-teal-500 focus:outline-hidden"
                          aria-label={`${sub.subjectName} credit allocation`}
                        />

                        <button
                          type="button"
                          onClick={() => handleIncrement(sub.subjectId)}
                          className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                          aria-label={`Increase ${sub.subjectName} credits`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Before and After badge */}
                      <div className="text-right min-w-[80px]">
                        <span className="text-xs text-slate-400 uppercase block">Before → After</span>
                        <div className="font-mono font-bold text-slate-300 text-xs">
                          {sub.allocatedCredits} → <span className="text-teal-400 font-bold">{currentVal}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 6: BEFORE AND AFTER REVIEW CARD */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Before & After Reallocation Summary</span>
              <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                No Fee Change (Equal Rate)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {pkg.subjects.map((sub) => {
                const newVal = allocations[sub.subjectId] ?? sub.allocatedCredits;
                return (
                  <span key={sub.subjectId} className="inline-flex items-center gap-1 font-medium text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sub.subjectColor }} />
                    {sub.subjectName}: <strong>{sub.allocatedCredits}</strong> → <strong className="text-teal-400">{newVal}</strong>
                  </span>
                );
              })}
              <span className="font-semibold text-slate-300 ml-auto">
                Total: {pkg.totalEntitlement} classes (unchanged)
              </span>
            </div>
          </div>

          {/* VALIDATION CONSTRAINTS / CONFLICTS */}
          {validationResult && !validationResult.valid && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Reallocation Constraint Blocked</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-rose-300">
                {validationResult.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult && validationResult.valid && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Valid allocation configuration. Sum matches {pkg.totalEntitlement} classes and all future bookings are satisfied.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-xs text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}

          {/* STEP 5: AUDITED OPERATIONAL REASON */}
          <div>
            <label htmlFor="reallocatemodal-field-3" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Operational Reason (Audited in Credit Ledger) *
            </label>
            <input id="reallocatemodal-field-3"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student requested Chemistry boost for upcoming exams"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-hidden min-touch-target"
            />
            <p className="mt-1 text-xs text-slate-400">
              Reason is permanently logged in the auditable credit ledger along with role and timestamp.
            </p>
          </div>

          {/* STEP 7: CONFIRMATION CONTROLS */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || (validationResult && !validationResult.valid)}
              icon={ShieldCheck}
            >
              Confirm & Audit Reallocation
            </Button>
          </div>
        </form>
      </ModalShell>
  );
}
