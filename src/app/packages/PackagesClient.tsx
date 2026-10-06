"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Sparkles,
  History,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  AlertCircle,
} from "lucide-react";
import { PackageBalanceBreakdown } from "@/lib/types";
import { ReallocateModal } from "@/components/packages/ReallocateModal";
import { CreditLedgerModal } from "@/components/packages/CreditLedgerModal";

interface PackagesClientProps {
  packages: (PackageBalanceBreakdown & {
    studentName: string;
    studentCode: string;
    studentCountry: string;
    studentGrade: string;
    price: number;
    currency: string;
  })[];
  templates: any[];
}

export function PackagesClient({ packages, templates }: PackagesClientProps) {
  const router = useRouter();
  const [selectedForRealloc, setSelectedForRealloc] = useState<PackageBalanceBreakdown | null>(null);
  const [selectedForLedger, setSelectedForLedger] = useState<{
    id: string;
    number: string;
    name: string;
  } | null>(null);

  const handleSuccess = () => {
    setSelectedForRealloc(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Layers className="h-4 w-4" />
            <span>Shared Credit Balance Architecture</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Packages & Subject Allocations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-subject packages with shared pool, non-billing reallocation, and auditable class credit ledgers.
          </p>
        </div>
      </div>

      {/* Concept Explainer Banner */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-900">
        <div className="flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Essential Xello Business Rule:</span>
            <p className="text-slate-600 leading-relaxed">
              Students purchase a class package covering multiple subjects (e.g. 20 classes initially split 10 Chemistry / 10 English). During exams, coordinators can reallocate to 15 Chemistry / 5 English without canceling or repurchasing packages. Completed sessions retain historical subjects, and balance allocations can never fall below already consumed credits.
            </p>
          </div>
        </div>
      </div>

      {/* Active Student Packages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Active Student Packages ({packages.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.packageId}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-xs transition-all space-y-5"
            >
              {/* Card Top: Package Info & Student */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {pkg.packageName}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-600">
                      {pkg.packageNumber}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      {pkg.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>
                      Student: <strong>{pkg.studentName}</strong> ({pkg.studentCode})
                    </span>
                    <span>•</span>
                    <span>{pkg.studentGrade}</span>
                    <span>•</span>
                    <span>Location: {pkg.studentCountry}</span>
                  </div>
                </div>

                {/* Actions: Reallocate & View Ledger */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setSelectedForLedger({
                        id: pkg.packageId,
                        number: pkg.packageNumber,
                        name: pkg.packageName,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    Credit Ledger
                  </button>
                  <button
                    onClick={() => setSelectedForRealloc(pkg)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Reallocate Remaining Classes
                  </button>
                </div>
              </div>

              {/* Balance Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    1. Entitled
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    {pkg.totalEntitlement}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    2. Consumed
                  </span>
                  <div className="text-lg font-bold text-slate-700">
                    {pkg.totalConsumed}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    3. Remaining
                  </span>
                  <div className="text-lg font-bold text-teal-700">
                    {pkg.totalRemaining}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    4. Reserved
                  </span>
                  <div className="text-lg font-bold text-blue-700">
                    {pkg.totalReserved}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    5. Available
                  </span>
                  <div className="text-lg font-bold text-emerald-700">
                    {pkg.totalAvailable}
                  </div>
                </div>
              </div>

              {/* Subject Allocations Breakdown Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Subject Credit Allocations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pkg.subjects.map((sub) => (
                    <div
                      key={sub.subjectId}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: sub.subjectColor }}
                          />
                          <span className="text-xs font-bold text-slate-900">
                            {sub.subjectName}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {sub.subjectCode}
                        </span>
                      </div>

                      {/* Micro progress bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        <div
                          className="bg-slate-400 h-2"
                          style={{
                            width: `${(sub.consumedCredits / sub.allocatedCredits) * 100}%`,
                          }}
                          title={`Consumed: ${sub.consumedCredits}`}
                        />
                        <div
                          className="bg-blue-400 h-2"
                          style={{
                            width: `${(sub.reservedCredits / sub.allocatedCredits) * 100}%`,
                          }}
                          title={`Reserved: ${sub.reservedCredits}`}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[11px] text-center pt-1 border-t border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-400">Alloc</div>
                          <div className="font-bold text-slate-900">
                            {sub.allocatedCredits}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Used</div>
                          <div className="font-bold text-slate-600">
                            {sub.consumedCredits}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Remain</div>
                          <div className="font-bold text-teal-700">
                            {sub.remainingCredits}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Avail</div>
                          <div className="font-bold text-emerald-700">
                            {sub.availableCredits}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reusable Templates Reference */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Standard Package Templates ({templates.length})
        </h3>
        <p className="text-xs text-slate-500">
          Templates serve as presets for new student admissions. Changing a template never silently modifies already-purchased student packages.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{tpl.name}</span>
                <span className="font-bold text-xs text-teal-700">
                  ₹{tpl.defaultPrice.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {tpl.totalCredits} Classes • {tpl.durationMinutes} mins per session
              </div>
              {tpl.notes && (
                <div className="text-[11px] text-slate-400 italic">
                  {tpl.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reallocate Modal */}
      {selectedForRealloc && (
        <ReallocateModal
          pkg={selectedForRealloc}
          onClose={() => setSelectedForRealloc(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Credit Ledger Modal */}
      {selectedForLedger && (
        <CreditLedgerModal
          packageId={selectedForLedger.id}
          packageNumber={selectedForLedger.number}
          packageName={selectedForLedger.name}
          onClose={() => setSelectedForLedger(null)}
        />
      )}
    </div>
  );
}
