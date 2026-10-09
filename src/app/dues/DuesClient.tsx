"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  MessageCircle,
  Clock,
  Calendar,
  CheckCircle2,
  X,
  PhoneCall,
  Sparkles,
  RefreshCw,
  Plus,
} from "lucide-react";
import { errorMessage, readApiResponse } from "@/lib/client-api";
import { formatInTimeZone, formatDateOnly } from "@/lib/timezones";
import { MobileTabs } from "@/components/ui/MobileTabs";

interface DuesClientProps {
  overdueBands: {
    dueToday: any[];
    band1to7: any[];
    band8to15: any[];
    band16to30: any[];
    band30plus: any[];
  };
  exhaustingPackages: any[];
  expiringPackages: any[];
  unverifiedPayments: any[];
  promisedFollowUps: any[];
}

export function DuesClient({
  overdueBands,
  exhaustingPackages,
  expiringPackages,
  unverifiedPayments,
  promisedFollowUps,
}: DuesClientProps) {
  const router = useRouter();
  const [activeQueue, setActiveQueue] = useState<
    "overdue" | "exhausting" | "expiring" | "promised"
  >("overdue");

  // Log Follow-up Modal
  const [modalStudent, setModalStudent] = useState<any | null>(null);
  const [followUpType, setFollowUpType] = useState("OVERDUE_PAYMENT");
  const [outcome, setOutcome] = useState("PROMISED_PAYMENT");
  const [parentResponse, setParentResponse] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStudent) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: modalStudent.id,
          type: followUpType,
          outcome,
          parentResponse,
          promisedPaymentDate: promisedDate || null,
          nextActionDate: nextActionDate || null,
          notes,
        }),
      });

      const data = await readApiResponse<any>(res, "Failed to log follow-up");

      setModalStudent(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (phone: string, guardianName: string, studentName: string, amount?: number) => {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const msg = amount
      ? `Dear ${guardianName}, greetings from Xello Tuition. This is a gentle reminder regarding the outstanding tuition fee balance of ₹${amount.toLocaleString(
          "en-IN"
        )} for ${studentName}'s online classes. Kindly let us know if you have completed the transfer so we can verify and update your receipt.`
      : `Dear ${guardianName}, greetings from Xello Tuition regarding ${studentName}'s upcoming class schedule.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
            <AlertCircle className="h-4 w-4" />
            <span>Operational Work Queues</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Dues, Renewals & Follow-ups
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured queues for overdue collections, package exhaustion renewals, and prefilled WhatsApp communication.
          </p>
        </div>
      </div>

      {/* Queue Selection Tabs with Mobile Dropdown & Desktop Segmented Bar */}
      <MobileTabs
        tabs={[
          {
            id: "overdue",
            label: "Overdue Aging Bands",
            icon: AlertCircle,
            count:
              overdueBands.dueToday.length +
              overdueBands.band1to7.length +
              overdueBands.band8to15.length +
              overdueBands.band16to30.length +
              overdueBands.band30plus.length,
          },
          {
            id: "exhausting",
            label: "Low Credit Packages",
            icon: Sparkles,
            count: exhaustingPackages.length,
          },
          {
            id: "expiring",
            label: "Nearing Expiry",
            icon: Clock,
            count: expiringPackages.length,
          },
          {
            id: "promised",
            label: "Promised Dates",
            icon: CheckCircle2,
            count: promisedFollowUps.length,
          },
        ]}
        activeTab={activeQueue}
        onChange={(id) => setActiveQueue(id as any)}
      />

      {/* Queue 1: Overdue Aging Bands */}
      {activeQueue === "overdue" && (
        <div className="space-y-6">
          {overdueBands.band8to15.length === 0 &&
          overdueBands.band1to7.length === 0 &&
          overdueBands.dueToday.length === 0 &&
          overdueBands.band16to30.length === 0 &&
          overdueBands.band30plus.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900 p-12 text-center text-xs text-slate-400 shadow-xl">
              No overdue tuition balances in any aging band. All accounts are up-to-date!
            </div>
          ) : null}

          {/* Band: 8 to 15 Days Overdue */}
          {overdueBands.band8to15.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-slate-900 p-5 sm:p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                  Overdue: 8 to 15 Days ({overdueBands.band8to15.length})
                </span>
              </div>
              <div className="divide-y divide-slate-800/80">
                {overdueBands.band8to15.map((inv) => (
                  <div
                    key={inv.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {inv.student.name}
                        </span>
                        <span className="font-mono text-slate-400">
                          {inv.invoiceNumber}
                        </span>
                        <span className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                          Due on {formatDateOnly(inv.dueDate)}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-1">
                        Parent: <strong className="text-slate-200">{inv.student.guardianName}</strong> • WhatsApp: {inv.student.whatsappNumber} ({inv.student.country})
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs uppercase text-slate-400">Balance Due</span>
                        <div className="text-base font-bold text-red-400">
                          ₹{inv.balanceDue.toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* WhatsApp manual link */}
                      <a
                        href={getWhatsAppLink(
                          inv.student.whatsappNumber,
                          inv.student.guardianName,
                          inv.student.name,
                          inv.balanceDue
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        WhatsApp
                      </a>

                      {/* Log follow-up */}
                      <button
                        onClick={() => {
                          setModalStudent(inv.student);
                          setFollowUpType("OVERDUE_PAYMENT");
                          setParentResponse("");
                          setPromisedDate("");
                          setNotes("");
                        }}
                        className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all active:scale-95"
                      >
                        Log Call
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Band: 1 to 7 Days Overdue */}
          {overdueBands.band1to7.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-slate-900 p-5 sm:p-6 shadow-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Overdue: 1 to 7 Days ({overdueBands.band1to7.length})
              </span>
              <div className="divide-y divide-slate-800/80">
                {overdueBands.band1to7.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{inv.student.name}</span> • <span className="text-amber-300 font-bold">₹{inv.balanceDue.toLocaleString("en-IN")} due</span>
                    </div>
                    <button
                      onClick={() => setModalStudent(inv.student)}
                      className="inline-flex items-center min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:text-white"
                    >
                      Follow-up
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue 2: Exhausting Packages (<3 Credits Remaining) */}
      {activeQueue === "exhausting" && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Packages with ≤ 3 Classes Remaining ({exhaustingPackages.length})
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {exhaustingPackages.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                No packages currently nearing exhaustion.
              </div>
            ) : (
              exhaustingPackages.map((pkg) => {
                const consumed = pkg.sessions.filter((s: any) => s.isCreditConsumed).length;
                const remaining = pkg.totalCredits - consumed;

                return (
                  <div
                    key={pkg.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 text-xs transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {pkg.student.name}
                        </span>
                        <span className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                          {remaining} Classes Remaining
                        </span>
                        <span className="text-slate-400">{pkg.name}</span>
                      </div>
                      <div className="text-slate-400 mt-1">
                        Parent: {pkg.student.guardianName} ({pkg.student.whatsappNumber})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={getWhatsAppLink(
                          pkg.student.whatsappNumber,
                          pkg.student.guardianName,
                          pkg.student.name
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] rounded-xl bg-emerald-500 px-3.5 py-2 font-bold text-slate-950 hover:bg-emerald-400 flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        Chat Renewal
                      </a>
                      <button
                        onClick={() => {
                          setModalStudent(pkg.student);
                          setFollowUpType("PACKAGE_EXHAUSTION");
                        }}
                        className="inline-flex items-center min-h-[44px] rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
                      >
                        Log Renewal Action
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Follow-up Logging Modal */}
      {modalStudent && (
        <ModalShell labelledBy="followup-title" onClose={() => setModalStudent(null)} maxWidth="max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 id="followup-title" className="text-base font-bold text-white">
                Log Follow-up Call / Interaction
              </h2>
              <button
                type="button"
                onClick={() => setModalStudent(null)}
                aria-label="Close"
                className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleLogFollowUp} className="mt-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
                <span className="font-bold text-white">
                  {modalStudent.name} • Parent: {modalStudent.guardianName}
                </span>
                <div className="text-xs text-slate-400 mt-1">
                  WhatsApp: {modalStudent.whatsappNumber}
                </div>
              </div>

              <div>
                <label htmlFor="duesclient-field-1" className="block font-bold text-slate-300 uppercase mb-1">
                  Call / Contact Outcome *
                </label>
                <select id="duesclient-field-1"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium"
                >
                  <option value="PROMISED_PAYMENT" className="bg-slate-900">Promised Payment Date</option>
                  <option value="REQUESTED_CALLBACK" className="bg-slate-900">Parent Requested Callback</option>
                  <option value="DISPUTED" className="bg-slate-900">Billing / Allocation Query</option>
                  <option value="RESOLVED" className="bg-slate-900">Resolved</option>
                  <option value="UNREACHABLE" className="bg-slate-900">Unreachable / No Answer</option>
                </select>
              </div>

              <div>
                <label htmlFor="duesclient-field-2" className="block font-bold text-slate-300 uppercase mb-1">
                  Parent Response Summary
                </label>
                <input id="duesclient-field-2"
                  type="text"
                  value={parentResponse}
                  onChange={(e) => setParentResponse(e.target.value)}
                  placeholder="e.g. Transferring funds from Riyadh this weekend"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="duesclient-field-3" className="block font-bold text-slate-300 uppercase mb-1">
                    Promised Date
                  </label>
                  <input id="duesclient-field-3"
                    type="date"
                    value={promisedDate}
                    onChange={(e) => setPromisedDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="duesclient-field-4" className="block font-bold text-slate-300 uppercase mb-1">
                    Next Action Date
                  </label>
                  <input id="duesclient-field-4"
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="duesclient-field-5" className="block font-bold text-slate-300 uppercase mb-1">
                  Internal Notes
                </label>
                <textarea id="duesclient-field-5"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-3 text-red-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalStudent(null)}
                  className="inline-flex items-center min-h-[44px] rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center min-h-[44px] rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? "Saving..." : "Record Follow-up"}
                </button>
              </div>
            </form>
          </ModalShell>
      )}
    </div>
  );
}
