"use client";

import { useEffect, useState, useMemo } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, controlClass, controlBorder } from "@/components/ui/Field";
import { PACKAGE_PRESETS } from "@/lib/package-presets";
import { PackageBalanceBreakdown } from "@/lib/types";
import { apiRequest, errorMessage as toErrorMessage } from "@/lib/client-api";
import {
  Layers,
  History,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";

interface EditPackageModalProps {
  pkg: PackageBalanceBreakdown;
  studentName?: string;
  studentCode?: string;
  onClose: () => void;
  onSuccess: (updatedPkg?: PackageBalanceBreakdown) => void;
}

interface EditHistoryItem {
  id: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  previous?: {
    name?: string;
    totalCredits?: number;
    price?: number;
    startDate?: string;
    expiryDate?: string | null;
    status?: string;
    notes?: string | null;
  };
  updated?: {
    name?: string;
    totalCredits?: number;
    price?: number;
    startDate?: string;
    expiryDate?: string | null;
    status?: string;
    notes?: string | null;
  };
  classesAttended?: number;
  remainingClasses?: number;
  outstandingBalance?: number;
}

export function EditPackageModal({
  pkg,
  studentName,
  studentCode,
  onClose,
  onSuccess,
}: EditPackageModalProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [classesAttended, setClassesAttended] = useState(pkg.totalConsumed ?? 0);
  const [totalPaid, setTotalPaid] = useState(pkg.paidAmount ?? 0);

  // Form inputs
  const [name, setName] = useState(pkg.packageName);
  const [totalCredits, setTotalCredits] = useState(String(pkg.totalEntitlement));
  const [price, setPrice] = useState(String(pkg.price ?? 0));
  const [startDate, setStartDate] = useState(pkg.startDate ? pkg.startDate.slice(0, 10) : "");
  const [expiryDate, setExpiryDate] = useState(pkg.expiryDate ? pkg.expiryDate.slice(0, 10) : "");
  const [status, setStatus] = useState<string>(pkg.status || "ACTIVE");
  const [notes, setNotes] = useState(pkg.notes || "");

  // Subject allocations
  const [allocations, setAllocations] = useState<{ [subjectId: string]: number }>(() => {
    const map: { [id: string]: number } = {};
    for (const sub of pkg.subjects || []) {
      map[sub.subjectId] = sub.allocatedCredits;
    }
    return map;
  });

  const [confirmFewer, setConfirmFewer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load detailed history & accurate session attendance from backend
  useEffect(() => {
    let cancelled = false;
    apiRequest<{
      classesAttended: number;
      totalPaid: number;
      editHistory: EditHistoryItem[];
      rawPackage?: any;
    }>(`/api/packages/${pkg.packageId}`)
      .then((data) => {
        if (!cancelled) {
          if (data.classesAttended !== undefined) setClassesAttended(data.classesAttended);
          if (data.totalPaid !== undefined) setTotalPaid(data.totalPaid);
          if (data.editHistory) setHistory(data.editHistory);
          if (data.rawPackage?.notes && !notes) setNotes(data.rawPackage.notes);
        }
      })
      .catch((err) => {
        console.error("Could not load package details", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pkg.packageId]);

  // Derived live recalculations
  const numTotalCredits = Math.max(1, Number(totalCredits) || 0);
  const numPrice = Math.max(0, Number(price) || 0);
  const remainingClasses = numTotalCredits - classesAttended;
  const outstandingBalance = Math.max(0, numPrice - totalPaid);
  const isFewerThanAttended = numTotalCredits < classesAttended;

  // Selected preset check
  const selectedPreset = useMemo(() => {
    return PACKAGE_PRESETS.find(
      (p) => p.totalCredits === String(numTotalCredits) && p.name.toLowerCase() === name.trim().toLowerCase()
    );
  }, [numTotalCredits, name]);

  const applyPreset = (preset: (typeof PACKAGE_PRESETS)[0]) => {
    setName(preset.name);
    setTotalCredits(preset.totalCredits);
    setPrice(preset.price);
    // Rebalance allocations proportionally
    const target = Number(preset.totalCredits);
    rebalanceAllocations(target);
  };

  const rebalanceAllocations = (newTotal: number) => {
    const subjects = pkg.subjects || [];
    if (subjects.length === 0) return;
    const oldTotal = Object.values(allocations).reduce((a, b) => a + Number(b || 0), 0) || 1;
    let sum = 0;
    const next: { [id: string]: number } = {};
    for (let i = 0; i < subjects.length; i++) {
      const sub = subjects[i];
      const isLast = i === subjects.length - 1;
      const currentVal = allocations[sub.subjectId] ?? sub.allocatedCredits;
      const share = isLast
        ? Math.max(0, newTotal - sum)
        : Math.max(0, Math.round((currentVal / oldTotal) * newTotal));
      sum += share;
      next[sub.subjectId] = share;
    }
    setAllocations(next);
  };

  const handleTotalCreditsChange = (val: string) => {
    setTotalCredits(val);
    const num = Number(val);
    if (Number.isInteger(num) && num > 0) {
      rebalanceAllocations(num);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setErrorMsg("Please enter a package name.");
      return;
    }
    if (numTotalCredits < 1) {
      setErrorMsg("Total classes must be at least 1.");
      return;
    }
    if (isFewerThanAttended && !confirmFewer) {
      setErrorMsg("Please confirm reducing total classes below already attended classes.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const allocPayload =
        pkg.subjects && pkg.subjects.length > 0
          ? pkg.subjects.map((s) => ({
              subjectId: s.subjectId,
              allocatedCredits: allocations[s.subjectId] ?? s.allocatedCredits,
            }))
          : undefined;

      const res = await apiRequest<{ success: boolean; message: string; package: PackageBalanceBreakdown }>(
        `/api/packages/${pkg.packageId}`,
        {
          method: "PATCH",
          body: {
            name: name.trim(),
            totalCredits: numTotalCredits,
            price: numPrice,
            startDate,
            expiryDate: expiryDate || null,
            status,
            notes: notes ? notes.trim() : null,
            allocations: allocPayload,
            confirmFewerThanAttended: confirmFewer,
          },
        }
      );

      onSuccess(res.package);
    } catch (err) {
      setErrorMsg(toErrorMessage(err, "Failed to update package."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      labelledBy="edit-package-title"
      onClose={onClose}
      closeDisabled={saving}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <h3 id="edit-package-title" className="text-base font-bold text-white">
                  Edit Package
                </h3>
                <p className="text-xs text-slate-400">
                  {pkg.packageNumber} · {studentName ? `${studentName} (${studentCode})` : "Student Package"}
                </p>
              </div>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              aria-pressed={activeTab === "edit"}
              className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                activeTab === "edit" ? "bg-teal-400 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Package Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              aria-pressed={activeTab === "history"}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                activeTab === "history" ? "bg-teal-400 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Edit History {history.length > 0 && `(${history.length})`}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Edit Form */}
        {activeTab === "edit" && (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Package Presets */}
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
              <span id="package-type-label" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Select Package Type
              </span>
              <div role="group" aria-labelledby="package-type-label" className="flex flex-wrap gap-2">
                {PACKAGE_PRESETS.map((preset) => {
                  const isSelected = selectedPreset?.label === preset.label;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      aria-pressed={isSelected}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all border ${
                        isSelected
                          ? "bg-teal-400 text-slate-950 border-teal-400 shadow-sm"
                          : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-teal-500/40 hover:text-white"
                      }`}
                    >
                      {preset.label} (₹{Number(preset.price).toLocaleString("en-IN")})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPreset) setName("Custom Package");
                  }}
                  aria-pressed={!selectedPreset}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-semibold transition-all border ${
                    !selectedPreset
                      ? "bg-teal-400/20 text-teal-300 border-teal-500/50"
                      : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Core Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <Field label="Package Name" required>
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)}`}
                      placeholder="e.g. Monthly Package (3 Classes/week)"
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="Total Package Classes" required>
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      min={1}
                      value={totalCredits}
                      onChange={(e) => handleTotalCreditsChange(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)} tabular-nums`}
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="Total Package Amount (₹)" required>
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)} tabular-nums`}
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="Start Date" required>
                  {(p) => (
                    <input
                      {...p}
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)}`}
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="End Date / Expiry (optional)">
                  {(p) => (
                    <input
                      {...p}
                      type="date"
                      value={expiryDate}
                      min={startDate || undefined}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)}`}
                    />
                  )}
                </Field>
              </div>

              <div>
                <Field label="Package Status" required>
                  {(p) => (
                    <select
                      {...p}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)}`}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="EXHAUSTED">EXHAUSTED</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  )}
                </Field>
              </div>

              <div>
                <Field label="Notes (optional)">
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={`${controlClass} ${controlBorder(false)}`}
                      placeholder="Optional remarks"
                    />
                  )}
                </Field>
              </div>
            </div>

            {/* Subject Allocations breakdown (if multiple enrolled subjects) */}
            {pkg.subjects && pkg.subjects.length > 1 && (
              <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <span className="text-sm font-semibold text-slate-300">
                    Subject Class Distribution ({numTotalCredits} classes total)
                  </span>
                  <button
                    type="button"
                    onClick={() => rebalanceAllocations(numTotalCredits)}
                    className="inline-flex min-h-[44px] items-center text-sm text-teal-400 hover:underline font-semibold"
                  >
                    Auto-balance
                  </button>
                </div>
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {pkg.subjects.map((sub) => (
                    <div key={sub.subjectId} className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-sm space-y-1">
                      <span className="font-semibold text-white break-words block">{sub.subjectName}</span>
                      <div className="flex items-center justify-between gap-2 text-slate-400">
                        <span aria-hidden="true">Classes:</span>
                        <input
                          aria-label={`${sub.subjectName} classes`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={allocations[sub.subjectId] ?? sub.allocatedCredits}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              [sub.subjectId]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="min-h-[44px] w-20 rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-center text-base text-white font-bold focus:outline-none focus:ring-2 focus:ring-brand/60 sm:text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Live Recalculations Card (Satisfies Requirements 4, 6, 7) */}
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-400" />
                <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                  Live Package Calculations
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                  <span className="text-xs text-slate-400 block">Total Classes</span>
                  <span className="text-base font-bold text-white tabular-nums">{numTotalCredits}</span>
                </div>
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                  <span className="text-xs text-slate-400 block">Classes Attended</span>
                  <span className="text-base font-bold text-slate-300 tabular-nums">{classesAttended}</span>
                </div>
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                  <span className="text-xs text-teal-400 block">Remaining Classes</span>
                  <span className={`text-base font-bold tabular-nums ${remainingClasses < 0 ? "text-rose-400" : "text-teal-300"}`}>
                    {remainingClasses}
                  </span>
                  <span className="text-xs text-slate-400 block">Total - Attended</span>
                </div>
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
                  <span className="text-xs text-blue-400 block">Outstanding Balance</span>
                  <span className="text-base font-bold text-white tabular-nums">
                    ₹{outstandingBalance.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-400 block">Paid: ₹{totalPaid.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed border-t border-teal-500/20 pt-2">
                ✓ Preserves all previously recorded payments (<strong>₹{totalPaid.toLocaleString("en-IN")}</strong>) and completed classes (<strong>{classesAttended}</strong>).
                Outstanding balance recalculates automatically as <strong>₹{numPrice.toLocaleString("en-IN")} - ₹{totalPaid.toLocaleString("en-IN")} = ₹{outstandingBalance.toLocaleString("en-IN")}</strong>.
              </p>
            </div>

            {/* Warning if fewer than attended (Requirement 10) */}
            {isFewerThanAttended && (
              <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-sm text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="text-amber-300 block">Fewer Classes Than Already Attended:</strong>
                    The student has already attended <strong>{classesAttended} classes</strong> on this package.
                    Updating the total to <strong>{numTotalCredits} classes</strong> will result in attended classes exceeding the new total limit ({remainingClasses} remaining).
                  </div>
                </div>
                <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmFewer}
                    onChange={(e) => setConfirmFewer(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-amber-400 rounded"
                  />
                  <span>I understand and confirm updating total classes below attended classes</span>
                </label>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || (isFewerThanAttended && !confirmFewer)}>
                {saving ? "Saving Changes..." : "Save Package Changes"}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Edit History (Satisfies Requirement 11) */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
              Complete audit log of all modifications made to this package by Admins and Coordinators.
            </div>

            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
                No previous edits recorded for this package.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {history.map((item, idx) => (
                  <div key={item.id || idx} className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-white font-semibold">
                        <Clock className="h-3.5 w-3.5 text-teal-400" />
                        <span>{new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</span>
                      </div>
                      <span className="text-slate-400">
                        Modified by: <strong className="text-slate-200">{item.actorName}</strong> ({item.actorRole})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="rounded-lg bg-slate-950/70 p-2.5 border border-slate-800 space-y-1">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                          Previous Details
                        </span>
                        <div className="text-slate-300 space-y-0.5">
                          <p>Name: <span className="text-white font-medium">{item.previous?.name ?? "—"}</span></p>
                          <p>Classes: <span className="text-white font-medium">{item.previous?.totalCredits ?? "—"}</span></p>
                          <p>Amount: <span className="text-white font-medium">₹{Number(item.previous?.price ?? 0).toLocaleString("en-IN")}</span></p>
                          <p>Status: <span className="text-white font-medium">{item.previous?.status ?? "—"}</span></p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-teal-500/5 p-2.5 border border-teal-500/20 space-y-1">
                        <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider block">
                          Updated Details
                        </span>
                        <div className="text-slate-200 space-y-0.5">
                          <p>Name: <span className="text-teal-300 font-semibold">{item.updated?.name ?? "—"}</span></p>
                          <p>Classes: <span className="text-teal-300 font-semibold">{item.updated?.totalCredits ?? "—"}</span></p>
                          <p>Amount: <span className="text-teal-300 font-semibold">₹{Number(item.updated?.price ?? 0).toLocaleString("en-IN")}</span></p>
                          <p>Status: <span className="text-teal-300 font-semibold">{item.updated?.status ?? "—"}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setActiveTab("edit")}>
                Back to Edit Form
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
