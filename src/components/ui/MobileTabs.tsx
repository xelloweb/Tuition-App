import React, { useId } from "react";
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

/** Section switcher: a dropdown on phones, a row of buttons from 640px up. */
export function MobileTabs({
  tabs,
  activeTab,
  onChange,
  className = "",
}: MobileTabsProps) {
  const selectId = useId();

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Mobile Dropdown (shown on screens < sm) */}
      <div className="block sm:hidden">
        <label htmlFor={selectId} className="sr-only">
          Select section
        </label>
        <div className="relative">
          {/* 16px text: smaller text makes iPhones zoom in when the dropdown is tapped. */}
          <select
            id={selectId}
            value={activeTab}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[48px] w-full appearance-none rounded-card border border-line-strong bg-surface px-4 py-3 pr-10 text-base font-bold text-ink shadow-lg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id} className="bg-surface text-ink">
                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-brand-text">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Horizontal Segmented Bar */}
      <div
        role="group"
        aria-label="Sections"
        className="hidden sm:flex items-center gap-1.5 p-1 rounded-card bg-surface border border-line overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex min-h-[44px] items-center gap-2 rounded-control px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-brand/15 text-brand-text border border-brand/40 shadow-xs"
                  : "text-ink-muted hover:text-ink hover:bg-raised border border-transparent"
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-text" : "text-ink-muted"}`}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive
                      ? "bg-brand/20 text-brand-text border border-brand/30"
                      : "bg-raised text-ink-muted border border-line"
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
