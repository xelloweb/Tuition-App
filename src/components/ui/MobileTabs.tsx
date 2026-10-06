import React from "react";
import { LucideIcon, ChevronDown } from "lucide-react";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface MobileTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function MobileTabs({
  tabs,
  activeTab,
  onChange,
  className = "",
}: MobileTabsProps) {
  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];
  const CurrentIcon = currentTab?.icon;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Mobile Dropdown (shown on screens < sm) */}
      <div className="block sm:hidden">
        <label htmlFor="tab-select" className="sr-only">
          Select section
        </label>
        <div className="relative">
          <select
            id="tab-select"
            value={activeTab}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-sm font-bold text-white shadow-lg focus:border-teal-400 focus:outline-hidden pr-10"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id} className="bg-slate-900 text-white">
                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-teal-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Horizontal Segmented Bar */}
      <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap min-touch-target ${
                isActive
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-teal-300" : "text-slate-500"
                  }`}
                />
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-teal-400/20 text-teal-200 border border-teal-400/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700/50"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
