"use client";

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
import { formatInTimeZone } from "@/lib/timezones";

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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify payment");
      }

      setSelectedPaymentForVerify(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }

      setNewInvoiceModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Receipt className="h-4 w-4" />
            <span>Accounts & Billing Operations</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Invoices, Payments & Collections
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strictly decoupled billing accounts, proof verification workflows, and unallocated advance handling.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg("");
            setNewInvoiceModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Net Billed</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            ₹{financialStats.netBilled.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Verified Paid</span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            ₹{financialStats.verifiedCollections.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Total Outstanding</span>
          <div className="text-xl font-bold text-blue-700 mt-1">
            ₹{financialStats.outstanding.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Overdue Dues</span>
          <div className="text-xl font-bold text-red-700 mt-1">
            ₹{financialStats.overdue.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium">Unallocated Advances</span>
          <div className="text-xl font-bold text-purple-700 mt-1">
            ₹{financialStats.unallocatedAdvances.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Proof Policy Callout */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Operational Verification Rule:</span> A parent payment slip or receipt upload does NOT reduce invoice outstanding balances until verified by Accounts staff against bank statements.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "invoices"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Invoices & Instalments ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("verification")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "verification"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="h-4 w-4" />
          Payment Proof Verification Inbox ({unverifiedPayments.length})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === "payments"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          All Payment Records ({payments.length})
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === "invoices" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "OVERDUE"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {inv.status}
                    </span>
                    <span className="text-slate-400 font-medium">
                      Student: <strong>{inv.student.name}</strong> ({inv.student.studentCode})
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span>Due: {formatInTimeZone(inv.dueDate, "Asia/Kolkata")}</span>
                    <span>•</span>
                    <span>Total: ₹{inv.totalAmount.toLocaleString("en-IN")}</span>
                    <span>•</span>
                    <span>Paid: ₹{inv.paidAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase">Balance Due</span>
                    <div className="font-bold text-sm text-slate-900">
                      ₹{inv.balanceDue.toLocaleString("en-IN")}
                    </div>
                  </div>

                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-xs shadow-2xs"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print / View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Verification Inbox */}
      {activeTab === "verification" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Unverified Payment Proofs Awaiting Accounts Clearance
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {unverifiedPayments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                All submitted payments have been verified!
              </div>
            ) : (
              unverifiedPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {pay.paymentNumber}
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        PENDING CLEARANCE
                      </span>
                      <span className="font-bold text-slate-900">
                        {pay.student.name} ({pay.student.studentCode})
                      </span>
                    </div>
                    <div className="text-slate-500">
                      Method: <strong>{pay.paymentMethod}</strong> • Ref: {pay.reference || "N/A"} • Amount: ₹{pay.amount.toLocaleString("en-IN")}
                    </div>
                    {pay.proofFileName && (
                      <div className="text-teal-700 text-[11px] font-medium">
                        Uploaded Proof Slip: {pay.proofFileName}
                      </div>
                    )}
                    {pay.notes && (
                      <div className="text-slate-400 italic text-[11px]">
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs shrink-0"
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      {pay.paymentNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pay.isVerified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {pay.isVerified ? "VERIFIED" : "UNVERIFIED"}
                    </span>
                    <span className="text-slate-700 font-semibold">
                      {pay.student.name}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">
                    {formatInTimeZone(pay.receivedDate, "Asia/Kolkata")} • Method: {pay.paymentMethod} • Ref: {pay.reference || "None"}
                  </div>
                  {pay.isVerified && (
                    <div className="text-[11px] text-emerald-700">
                      Verified by {pay.verifiedByName} on {formatInTimeZone(pay.verifiedAt, "Asia/Kolkata")}
                    </div>
                  )}
                </div>

                <div className="text-right font-bold text-sm text-slate-900">
                  ₹{pay.amount.toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {selectedPaymentForVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Verify & Allocate Payment
              </h3>
              <button
                onClick={() => setSelectedPaymentForVerify(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="font-bold text-slate-900">
                  {selectedPaymentForVerify.student.name} • ₹{selectedPaymentForVerify.amount.toLocaleString("en-IN")}
                </span>
                <div className="text-[11px] text-slate-500 mt-1">
                  Payment No: {selectedPaymentForVerify.paymentNumber} • Method: {selectedPaymentForVerify.paymentMethod}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Allocate to Unpaid Invoice
                </label>
                <select
                  value={targetInvoiceId}
                  onChange={(e) => setTargetInvoiceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                >
                  <option value="">Hold as Unallocated Advance</option>
                  {selectedPaymentForVerify.student.invoices
                    ?.filter((inv: any) => inv.balanceDue > 0)
                    .map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} (Balance Due: ₹{inv.balanceDue.toLocaleString("en-IN")})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Allocating to invoice reduces its balance due immediately upon verification.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Bank Clearance Reference / Notes
                </label>
                <input
                  type="text"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="e.g. Cleared via ICICI Netbanking txn #882910"
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
                  onClick={() => setSelectedPaymentForVerify(null)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Approve & Settle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 no-print">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">
                Official Tuition Invoice & Receipt
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Invoice Printable Body */}
            <div className="mt-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">XELLO TUITION</h3>
                  <p className="text-xs text-slate-500">Kerala & GCC Online 1-to-1 Operations</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-slate-900">{previewInvoice.invoiceNumber}</div>
                  <div className="text-xs text-slate-500">Date: {formatInTimeZone(previewInvoice.issueDate, "Asia/Kolkata")}</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Billed To:</span>
                  <div className="font-bold text-slate-900 text-sm">{previewInvoice.student.name}</div>
                  <div className="text-slate-600">ID: {previewInvoice.student.studentCode} • {previewInvoice.student.grade}</div>
                  <div className="text-slate-600">Parent: {previewInvoice.student.guardianName}</div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Payment Status:</span>
                  <div className="font-bold text-emerald-700 text-sm">{previewInvoice.status}</div>
                  <div className="text-slate-600">Due Date: {formatInTimeZone(previewInvoice.dueDate, "Asia/Kolkata")}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
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
                      <td className="py-2 text-center text-slate-600">{it.quantity}</td>
                      <td className="py-2 text-right text-slate-600">₹{it.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-right font-bold text-slate-900">₹{it.amount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-200 pt-3 flex flex-col items-end text-xs space-y-1">
                <div className="flex justify-between w-48">
                  <span className="text-slate-500">Total Billed:</span>
                  <span className="font-bold text-slate-900">₹{previewInvoice.totalAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span className="text-slate-500">Verified Paid:</span>
                  <span className="font-bold text-emerald-700">₹{previewInvoice.paidAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between w-48 text-sm font-black border-t border-slate-200 pt-1">
                  <span>Balance Due:</span>
                  <span className="text-blue-700">₹{previewInvoice.balanceDue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {newInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Invoice</h3>
              <button
                onClick={() => setNewInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Student *
                </label>
                <select
                  required
                  value={invStudentId}
                  onChange={(e) => setInvStudentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                >
                  <option value="">Choose Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Total Amount (INR) *
                </label>
                <input
                  type="number"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
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
                  onClick={() => setNewInvoiceModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
