"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  CheckCircle,
  Clock,
  DollarSign,
  Plus,
  ShieldCheck,
  AlertCircle,
  Printer,
  FileCheck,
  X,
  CreditCard,
  Building,
} from "lucide-react";
import { errorMessage, readApiResponse } from "@/lib/client-api";
import { formatInTimeZone, formatDateOnly } from "@/lib/timezones";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordPaymentDialog } from "@/components/billing/RecordPaymentDialog";

interface BillingClientProps {
  invoices: any[];
  payments: any[];
  unverifiedPayments: any[];
  students: any[];
  financialStats: {
    netBilled: number;
    verifiedCollections: number;
    outstanding: number;
    overdue: number;
    unallocatedAdvances: number;
  };
}

export function BillingClient({
  invoices,
  payments,
  unverifiedPayments,
  students,
  financialStats,
}: BillingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"invoices" | "verification" | "payments">("invoices");
  const [recordOpen, setRecordOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Verify modal state
  const [selectedPaymentForVerify, setSelectedPaymentForVerify] = useState<any | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Printable invoice preview modal state
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  // New Invoice Modal
  const [newInvoiceModalOpen, setNewInvoiceModalOpen] = useState(false);
  const [invStudentId, setInvStudentId] = useState("");
  const [invDescription, setInvDescription] = useState("20-Class Multi-Subject Package");
  const [invAmount, setInvAmount] = useState("18000");
  const [invDueDate, setInvDueDate] = useState("");

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForVerify) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/payments/${selectedPaymentForVerify.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: targetInvoiceId || undefined,
          notes: verificationNotes,
        }),
      });

      const data = await readApiResponse<any>(res, "Failed to verify payment");

      setSelectedPaymentForVerify(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: invStudentId,
          dueDate: invDueDate,
          items: [
            {
              description: invDescription,
              quantity: 1,
              unitPrice: Number(invAmount),
            },
          ],
        }),
      });

      const data = await readApiResponse<any>(res, "Failed to create invoice");

      setNewInvoiceModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & payments"
        context="Amounts in INR"
        description="Record what parents paid, verify it against the bank, and allocate it to invoices. Recording alone never reduces a balance."
        actions={
          <>
            <Button variant="secondary" onClick={() => { setRecordOpen(true); setBanner(null); }}>
              Record payment
            </Button>
            <Button icon={Plus} onClick={() => { setErrorMsg(""); setNewInvoiceModalOpen(true); }}>
              Create invoice
            </Button>
          </>
        }
      />
      {banner && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <span>{banner}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss message" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Net Billed</span>
          <div className="text-xl sm:text-2xl font-bold text-white mt-1">
            ₹{financialStats.netBilled.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-lg">
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Verified Paid</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300 mt-1">
            ₹{financialStats.verifiedCollections.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-lg">
          <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">Total Outstanding</span>
          <div className="text-xl sm:text-2xl font-bold text-blue-300 mt-1">
            ₹{financialStats.outstanding.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 shadow-lg">
          <span className="text-xs uppercase tracking-wider text-red-400 font-bold">Overdue Dues</span>
          <div className="text-xl sm:text-2xl font-bold text-red-300 mt-1">
            ₹{financialStats.overdue.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 shadow-lg col-span-2 sm:col-span-1">
          <span className="text-xs uppercase tracking-wider text-purple-400 font-bold">Unallocated Advances</span>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 mt-1">
            ₹{financialStats.unallocatedAdvances.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Proof Policy Callout */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300">Operational Verification Rule:</span> A parent payment slip or receipt upload does NOT reduce invoice outstanding balances until verified by Accounts staff against bank statements.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-x-auto scrollbar-none">
        <button
          type="button"
          aria-pressed={activeTab === "invoices"}
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap min-touch-target ${
            activeTab === "invoices"
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "verification"}
          onClick={() => setActiveTab("verification")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap min-touch-target ${
            activeTab === "verification"
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <Clock className="h-4 w-4" />
          Awaiting verification ({unverifiedPayments.length})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "payments"}
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap min-touch-target ${
            activeTab === "payments"
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          All payments ({payments.length})
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === "invoices" && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
          <div className="divide-y divide-slate-800/80">
            {invoices.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                No invoices recorded yet. Click &quot;Create Invoice&quot; to issue your first invoice.
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">
                        {inv.invoiceNumber}
                      </span>
                      <StatusBadge status={inv.status} size="sm" />
                      <span className="text-slate-400 font-medium">
                        Student: <strong className="text-slate-200">{inv.student.name}</strong> ({inv.student.studentCode})
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Due: {formatDateOnly(inv.dueDate)}</span>
                      <span>•</span>
                      <span>Total: ₹{inv.totalAmount.toLocaleString("en-IN")}</span>
                      <span>•</span>
                      <span>Paid: ₹{inv.paidAmount.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 uppercase">Balance Due</span>
                      <div className="font-bold text-sm text-white">
                        ₹{inv.balanceDue.toLocaleString("en-IN")}
                      </div>
                    </div>

                    <button
                      onClick={() => setPreviewInvoice(inv)}
                      className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 font-semibold text-slate-200 hover:bg-slate-700/80 hover:text-white flex items-center gap-1.5 text-xs shadow-xs transition-all active:scale-95"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print / View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Verification Inbox */}
      {activeTab === "verification" && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Unverified Payment Proofs Awaiting Accounts Clearance
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {unverifiedPayments.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                All submitted payments have been verified!
              </div>
            ) : (
              unverifiedPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 text-xs transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {pay.paymentNumber}
                      </span>
                      <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                        PENDING CLEARANCE
                      </span>
                      <span className="font-bold text-slate-200">
                        {pay.student.name} ({pay.student.studentCode})
                      </span>
                    </div>
                    <div className="text-slate-400">
                      Method: <strong className="text-slate-300">{pay.paymentMethod}</strong> • Ref: {pay.reference || "N/A"} • Amount: ₹{pay.amount.toLocaleString("en-IN")}
                    </div>
                    {pay.proofFileName && (
                      <div className="text-teal-400 text-xs font-medium">
                        Uploaded Proof Slip: {pay.proofFileName}
                      </div>
                    )}
                    {pay.notes && (
                      <div className="text-slate-400 italic text-xs">
                        Notes: {pay.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPaymentForVerify(pay);
                      setTargetInvoiceId(pay.student.invoices?.[0]?.id || "");
                      setVerificationNotes("");
                      setErrorMsg("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 shadow-xs shrink-0 transition-all active:scale-95"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Verify & Allocate Payment
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: All Payment Records */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl overflow-hidden">
          <div className="divide-y divide-slate-800/80">
            {payments.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">
                No payment records logged yet.
              </div>
            ) : (
              payments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 text-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {pay.paymentNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                          pay.isVerified
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                        }`}
                      >
                        {pay.isVerified ? "VERIFIED" : "UNVERIFIED"}
                      </span>
                      <span className="text-slate-200 font-semibold">
                        {pay.student.name}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1">
                      {formatDateOnly(pay.receivedDate)} • Method: {pay.paymentMethod} • Ref: {pay.reference || "None"}
                    </div>
                    {pay.isVerified && (
                      <div className="text-xs text-emerald-400">
                        Verified by {pay.verifiedByName} on {formatInTimeZone(pay.verifiedAt, "Asia/Kolkata")}
                      </div>
                    )}
                  </div>

                  <div className="text-right font-bold text-sm text-white">
                    ₹{pay.amount.toLocaleString("en-IN")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {selectedPaymentForVerify && (
        <ModalShell labelledBy="verify-title" onClose={() => setSelectedPaymentForVerify(null)} maxWidth="max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 id="verify-title" className="text-base font-bold text-white">
                Verify & Allocate Payment
              </h2>
              <button
                onClick={() => setSelectedPaymentForVerify(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
                <span className="font-bold text-white">
                  {selectedPaymentForVerify.student.name} • ₹{selectedPaymentForVerify.amount.toLocaleString("en-IN")}
                </span>
                <div className="text-xs text-slate-400 mt-1">
                  Payment No: {selectedPaymentForVerify.paymentNumber} • Method: {selectedPaymentForVerify.paymentMethod}
                </div>
              </div>

              <div>
                <label htmlFor="billingclient-field-1" className="block font-bold text-slate-300 uppercase mb-1">
                  Allocate to Unpaid Invoice
                </label>
                <select id="billingclient-field-1"
                  value={targetInvoiceId}
                  onChange={(e) => setTargetInvoiceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                >
                  <option value="">Hold as Unallocated Advance</option>
                  {selectedPaymentForVerify.student.invoices
                    ?.filter((inv: any) => inv.balanceDue > 0)
                    .map((inv: any) => (
                      <option key={inv.id} value={inv.id} className="bg-slate-900">
                        {inv.invoiceNumber} (Balance Due: ₹{inv.balanceDue.toLocaleString("en-IN")})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Allocating to invoice reduces its balance due immediately upon verification.
                </p>
              </div>

              <div>
                <label htmlFor="billingclient-field-2" className="block font-bold text-slate-300 uppercase mb-1">
                  Bank Clearance Reference / Notes
                </label>
                <input id="billingclient-field-2"
                  type="text"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="e.g. Cleared via ICICI Netbanking txn #882910"
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
                  onClick={() => setSelectedPaymentForVerify(null)}
                  className="rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? "Verifying..." : "Approve & Settle"}
                </button>
              </div>
            </form>
          </ModalShell>
      )}

      {/* Printable Invoice Modal */}
      {previewInvoice && (
        <ModalShell labelledBy="invoice-title" onClose={() => setPreviewInvoice(null)} maxWidth="max-w-2xl" panelClassName="rounded-card bg-white p-6 text-slate-900 sm:p-8">
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 no-print">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">
                Official Tuition Invoice & Receipt
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Invoice Printable Body */}
            <div className="mt-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 id="invoice-title" className="text-2xl font-bold text-slate-900">XELLO TUITION</h2>
                  <p className="text-xs text-slate-400">Kerala & GCC Online 1-to-1 Operations</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-slate-900">{previewInvoice.invoiceNumber}</div>
                  <div className="text-xs text-slate-400">Date: {formatInTimeZone(previewInvoice.issueDate, "Asia/Kolkata")}</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-xs">Billed To:</span>
                  <div className="font-bold text-slate-900 text-sm">{previewInvoice.student.name}</div>
                  <div className="text-slate-400">ID: {previewInvoice.student.studentCode} • {previewInvoice.student.grade}</div>
                  <div className="text-slate-400">Parent: {previewInvoice.student.guardianName}</div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-400 uppercase text-xs">Payment Status:</span>
                  <div className="font-bold text-emerald-700 text-sm">{previewInvoice.status}</div>
                  <div className="text-slate-400">Due Date: {formatInTimeZone(previewInvoice.dueDate, "Asia/Kolkata")}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-left">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewInvoice.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2 font-medium text-slate-800">{it.description}</td>
                      <td className="py-2 text-center text-slate-400">{it.quantity}</td>
                      <td className="py-2 text-right text-slate-400">₹{it.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-right font-bold text-slate-900">₹{it.amount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-200 pt-3 flex flex-col items-end text-xs space-y-1">
                <div className="flex justify-between w-48">
                  <span className="text-slate-400">Total Billed:</span>
                  <span className="font-bold text-slate-900">₹{previewInvoice.totalAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span className="text-slate-400">Verified Paid:</span>
                  <span className="font-bold text-emerald-700">₹{previewInvoice.paidAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between w-48 text-sm font-bold border-t border-slate-200 pt-1">
                  <span>Balance Due:</span>
                  <span className="text-blue-700">₹{previewInvoice.balanceDue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </ModalShell>
      )}

      {/* Create Invoice Modal */}
      {newInvoiceModalOpen && (
        <ModalShell labelledBy="new-invoice-title" onClose={() => setNewInvoiceModalOpen(false)} maxWidth="max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 id="new-invoice-title" className="text-base font-bold text-white">Create New Invoice</h2>
              <button
                onClick={() => setNewInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="mt-4 space-y-4 text-xs">
              <div>
                <label htmlFor="billingclient-field-3" className="block font-bold text-slate-300 uppercase mb-1">
                  Student *
                </label>
                <select id="billingclient-field-3"
                  required
                  value={invStudentId}
                  onChange={(e) => setInvStudentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
                >
                  <option value="" className="bg-slate-900">Choose Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name} ({s.studentCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="billingclient-field-4" className="block font-bold text-slate-300 uppercase mb-1">
                  Description *
                </label>
                <input id="billingclient-field-4"
                  type="text"
                  required
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label htmlFor="billingclient-field-5" className="block font-bold text-slate-300 uppercase mb-1">
                  Total Amount (INR) *
                </label>
                <input id="billingclient-field-5"
                  type="number"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label htmlFor="billingclient-field-6" className="block font-bold text-slate-300 uppercase mb-1">
                  Due Date *
                </label>
                <input id="billingclient-field-6"
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white"
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
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </ModalShell>
      )}
      {recordOpen && (
        <RecordPaymentDialog
          students={students}
          onClose={() => setRecordOpen(false)}
          onRecorded={(message) => {
            setRecordOpen(false);
            setBanner(message);
            setActiveTab("verification");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
