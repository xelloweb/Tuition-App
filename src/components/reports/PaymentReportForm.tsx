"use client";

import { useState } from "react";
import { Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export function PaymentReportForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleDownload = () => {
    if (!startDate || !endDate) return;
    const url = `/api/reports/export?type=payments&startDate=${startDate}&endDate=${endDate}`;
    window.location.href = url;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
      <div className="font-bold text-white text-sm">
        Payments Report (Date to Date)
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed">
        Export all received payments within a specific date range.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={!startDate || !endDate}
        className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 font-bold text-slate-950 hover:bg-teal-400 shadow-md text-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-3.5 w-3.5" />
        Download Payments CSV
      </button>
    </div>
  );
}
