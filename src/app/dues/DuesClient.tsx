"use client";

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
import { formatInTimeZone } from "@/lib/timezones";

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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log follow-up");
      }

      setModalStudent(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
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
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <AlertCircle className="h-4 w-4" />
            <span>Operational Work Queues</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Dues, Renewals & Follow-ups
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Structured queues for overdue collections, package exhaustion renewals, and prefilled WhatsApp communication.
          </p>
        </div>
      </div>

      {/* Queue Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveQueue("overdue")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeQueue === "overdue"
              ? "border-red-600 text-red-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Overdue Aging Bands (
          {overdueBands.dueToday.length +
            overdueBands.band1to7.length +
            overdueBands.band8to15.length +
            overdueBands.band16to30.length +
            overdueBands.band30plus.length}
          )
        </button>
        <button
          onClick={() => setActiveQueue("exhausting")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeQueue === "exhausting"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Packages Nearing Exhaustion ({exhaustingPackages.length})
        </button>
        <button
          onClick={() => setActiveQueue("expiring")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeQueue === "expiring"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          Nearing Expiry ({expiringPackages.length})
        </button>
        <button
          onClick={() => setActiveQueue("promised")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeQueue === "promised"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Promised Payment Dates ({promisedFollowUps.length})
        </button>
      </div>

      {/* Queue 1: Overdue Aging Bands */}
      {activeQueue === "overdue" && (
        <div className="space-y-6">
          {/* Band: 8 to 15 Days Overdue */}
          {overdueBands.band8to15.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-600" />
                  Overdue: 8 to 15 Days ({overdueBands.band8to15.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {overdueBands.band8to15.map((inv) => (
                  <div
                    key={inv.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {inv.student.name}
                        </span>
                        <span className="font-mono text-slate-600">
                          {inv.invoiceNumber}
                        </span>
                        <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          Due on {formatInTimeZone(inv.dueDate, "Asia/Kolkata")}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1">
                        Parent: <strong>{inv.student.guardianName}</strong> • WhatsApp: {inv.student.whatsappNumber} ({inv.student.country})
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-400">Balance Due</span>
                        <div className="text-base font-black text-red-700">
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
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-2xs"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
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
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
            <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Overdue: 1 to 7 Days ({overdueBands.band1to7.length})
              </span>
              <div className="divide-y divide-slate-100">
                {overdueBands.band1to7.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{inv.student.name}</span> • ₹{inv.balanceDue.toLocaleString("en-IN")} due
                    </div>
                    <button
                      onClick={() => setModalStudent(inv.student)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Packages with ≤ 3 Classes Remaining ({exhaustingPackages.length})
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {exhaustingPackages.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No packages currently nearing exhaustion.
              </div>
            ) : (
              exhaustingPackages.map((pkg) => {
                const consumed = pkg.sessions.filter((s: any) => s.isCreditConsumed).length;
                const remaining = pkg.totalCredits - consumed;

                return (
                  <div
                    key={pkg.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {pkg.student.name}
                        </span>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          {remaining} Classes Remaining
                        </span>
                        <span className="text-slate-500">{pkg.name}</span>
                      </div>
                      <div className="text-slate-500 mt-1">
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
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Chat Renewal
                      </a>
                      <button
                        onClick={() => {
                          setModalStudent(pkg.student);
                          setFollowUpType("PACKAGE_EXHAUSTION");
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Log Follow-up Call / Interaction
              </h3>
              <button
                onClick={() => setModalStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLogFollowUp} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-slate-900">
                  {modalStudent.name} • Parent: {modalStudent.guardianName}
                </span>
                <div className="text-[11px] text-slate-500 mt-1">
                  WhatsApp: {modalStudent.whatsappNumber}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Call / Contact Outcome *
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 font-medium"
                >
                  <option value="PROMISED_PAYMENT">Promised Payment Date</option>
                  <option value="REQUESTED_CALLBACK">Parent Requested Callback</option>
                  <option value="DISPUTED">Billing / Allocation Query</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="UNREACHABLE">Unreachable / No Answer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Parent Response Summary
                </label>
                <input
                  type="text"
                  value={parentResponse}
                  onChange={(e) => setParentResponse(e.target.value)}
                  placeholder="e.g. Transferring funds from Riyadh this weekend"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Promised Date
                  </label>
                  <input
                    type="date"
                    value={promisedDate}
                    onChange={(e) => setPromisedDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Next Action Date
                  </label>
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalStudent(null)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Record Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
