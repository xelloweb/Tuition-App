"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMoreDrawer } from "./MobileMoreDrawer";
import { CurrentUser } from "@/lib/types";

interface AppShellProps {
  currentUser: CurrentUser;
  displayTimeZone: string;
  ephemeralStorage?: boolean;
  children: React.ReactNode;
}

// Earlier versions cached student/trainer records (incl. guardian phone numbers)
// in the browser and showed them even when the server had no such record.
const LEGACY_STORAGE_KEYS = ["xello_registered_students_v1", "xello_registered_teachers_v1"];

export function AppShell({ currentUser, displayTimeZone, ephemeralStorage = false, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up then.
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[#070a12] text-slate-100 relative overflow-x-hidden selection:bg-teal-500 selection:text-white">
      {/* Ambient background glows for rich depth */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/5 blur-[140px] pointer-events-none" />

      {/* Desktop Persistent Sidebar */}
      <Sidebar
        currentRole={currentUser.role}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main View Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 relative z-10">
        <Header
          currentUser={currentUser}
          displayTimeZone={displayTimeZone}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Content area with bottom padding for mobile bottom bar */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-28 lg:pb-10">
          {ephemeralStorage && (
            <div role="alert" className="mx-auto max-w-7xl mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
              <span>
                <strong>Temporary storage:</strong> this deployment runs on a bundled SQLite copy. Changes are not shared between
                server instances and can disappear after a restart. Connect a PostgreSQL database before entering real records.
              </span>
            </div>
          )}
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Mobile Role-Aware Bottom Navigation (< 1024px) */}
        <MobileBottomNav
          currentRole={currentUser.role}
          onOpenMore={() => setMoreDrawerOpen(true)}
        />

        {/* Mobile "More" Drawer Modal */}
        <MobileMoreDrawer
          currentUser={currentUser}
          isOpen={moreDrawerOpen}
          onClose={() => setMoreDrawerOpen(false)}
        />
      </div>
    </div>
  );
}
