"use client";

import { useState } from "react";
import { Download, CalendarIcon } from "lucide-react";

export function PayoutReportForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleDownload = () => {
    if (!startDate || !endDate) return;
    const url = `/api/reports/export?type=payouts&startDate=${startDate}&endDate=${endDate}`;
    window.location.href = url;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Date Range</div>
        <input
          type="date"
          aria-label="From date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-base text-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-brand/60 sm:flex-none sm:text-sm"
        />
        <span className="text-slate-400 text-xs font-bold">to</span>
        <input
          type="date"
          aria-label="To date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-base text-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-brand/60 sm:flex-none sm:text-sm"
        />
      </div>
      <button
        onClick={handleDownload}
        disabled={!startDate || !endDate}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-all disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export CSV
      </button>
    </div>
  );
}
