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
    <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:block">Date Range</div>
        <input
          type="date"
          aria-label="From date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
        />
        <span className="text-slate-400 text-xs font-bold">to</span>
        <input
          type="date"
          aria-label="To date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
        />
      </div>
      <button
        onClick={handleDownload}
        disabled={!startDate || !endDate}
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-all disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </button>
    </div>
  );
}
