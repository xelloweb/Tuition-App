"use client";

import { useState } from "react";
import Link from "next/link";
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
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  /** Owner only: paid money not yet set up as a working package. */
  needsSetup?: { id: string; name: string; studentCode: string; reasons: string[] }[];
}

export function PackagesClient({ packages, templates, needsSetup = [] }: PackagesClientProps) {
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
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <Layers className="h-4 w-4" />
            <span>Shared Credit Balance Architecture</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Packages & Subject Allocations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-subject packages with shared pool, non-billing reallocation, and auditable class credit ledgers.
          </p>
        </div>
      </div>

      {needsSetup.length > 0 && (
        <section id="paid-not-set-up" aria-labelledby="paid-not-set-up-heading" className="space-y-3 rounded-card border border-warning/50 bg-surface p-4 sm:p-5">
          <h2 id="paid-not-set-up-heading" className="text-lg font-semibold text-ink">Paid, package not set up ({needsSetup.length})</h2>
          <p className="text-sm text-ink-muted">
            These students already paid, but that money is not yet a working package. Open each one and use “Assign package using
            existing payment”: no new payment or fee is created.
          </p>
          <ul className="divide-y divide-line">
            {needsSetup.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-ink">
                  <span className="font-semibold">{s.name}</span> <span className="font-mono text-ink-subtle">({s.studentCode})</span>
                  <span className="block text-ink-muted">{s.reasons.join(" · ")}</span>
                </span>
                <Link href={`/students/${s.id}?tab=packages`} className="inline-flex min-h-[44px] items-center rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised">
                  Set up package
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Concept Explainer Banner */}
      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-5 text-xs text-teal-200">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-teal-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold text-white text-sm">Essential Xello Business Rule:</span>
            <p className="text-slate-300 leading-relaxed text-xs">
              Students purchase a class package covering multiple subjects (e.g. 20 classes initially split 10 Chemistry / 10 English). During exams, coordinators can reallocate to 15 Chemistry / 5 English without canceling or repurchasing packages. Completed sessions retain historical subjects, and balance allocations can never fall below already consumed credits.
            </p>
          </div>
        </div>
      </div>

      {/* Active Student Packages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Student Packages ({packages.length})
          </h3>
        </div>

        {packages.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-12 text-center text-xs text-slate-400 shadow-xl">
            No active student packages enrolled. When students enroll with a package, their shared credit balance and subject split will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.packageId}
                className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl hover:border-slate-700/80 transition-all space-y-5"
              >
                {/* Card Top: Package Info & Student */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {pkg.packageName}
                      </span>
                      <span className="rounded-lg bg-slate-800 border border-slate-700/60 px-2 py-0.5 text-xs font-mono font-bold text-slate-300">
                        {pkg.packageNumber}
                      </span>
                      <StatusBadge status={pkg.status} size="sm" />
                    </div>
                    <div className="mt-1 text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span>
                        Student: <strong className="text-slate-200">{pkg.studentName}</strong> ({pkg.studentCode})
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
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white shadow-xs transition-all active:scale-95"
                    >
                      <History className="h-3.5 w-3.5 text-slate-400" />
                      Credit Ledger
                    </button>
                    <button
                      onClick={() => setSelectedForRealloc(pkg)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 shadow-xs transition-all active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Reallocate Remaining Classes
                    </button>
                  </div>
                </div>

                {/* Balance Summary Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 text-center">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      1. Entitled
                    </span>
                    <div className="text-xl font-bold text-white mt-0.5">
                      {pkg.totalEntitlement}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      2. Consumed
                    </span>
                    <div className="text-xl font-bold text-slate-300 mt-0.5">
                      {pkg.totalConsumed}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-teal-400 font-bold uppercase tracking-wider">
                      3. Remaining
                    </span>
                    <div className="text-xl font-bold text-teal-300 mt-0.5">
                      {pkg.totalRemaining}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                      4. Reserved
                    </span>
                    <div className="text-xl font-bold text-blue-300 mt-0.5">
                      {pkg.totalReserved}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                      5. Available
                    </span>
                    <div className="text-xl font-bold text-emerald-300 mt-0.5">
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
                        className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full ring-2 ring-slate-800"
                              style={{ backgroundColor: sub.subjectColor }}
                            />
                            <span className="text-xs font-bold text-white">
                              {sub.subjectName}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-400 font-mono">
                            {sub.subjectCode}
                          </span>
                        </div>

                        {/* Micro progress bar */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                          <div
                            className="bg-slate-500 h-2"
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

                        <div className="grid grid-cols-4 gap-1 text-xs text-center pt-1 border-t border-slate-800/80">
                          <div>
                            <div className="text-xs text-slate-400 uppercase">Alloc</div>
                            <div className="font-bold text-white">
                              {sub.allocatedCredits}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 uppercase">Used</div>
                            <div className="font-bold text-slate-400">
                              {sub.consumedCredits}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-teal-400 uppercase">Remain</div>
                            <div className="font-bold text-teal-300">
                              {sub.remainingCredits}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-emerald-400 uppercase">Avail</div>
                            <div className="font-bold text-emerald-300">
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
        )}
      </div>

      {/* Reusable Templates Reference */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white">
          Standard Package Templates ({templates.length})
        </h3>
        <p className="text-xs text-slate-400">
          Templates serve as presets for new student admissions. Changing a template never silently modifies already-purchased student packages.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{tpl.name}</span>
                <span className="font-bold text-xs text-teal-300">
                  ₹{tpl.defaultPrice.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {tpl.totalCredits} Classes • {tpl.durationMinutes} mins per session
              </div>
              {tpl.notes && (
                <div className="text-xs text-slate-400 italic">
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
