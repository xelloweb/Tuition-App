"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMoreDrawer } from "./MobileMoreDrawer";
import { CurrentUser } from "@/lib/types";
import { Notice } from "@/components/ui/Notice";

interface AppShellProps {
  currentUser: CurrentUser;
  /** Today's date in IST, formatted on the server. */
  istToday: string;
  ephemeralStorage?: boolean;
  children: React.ReactNode;
}

// Earlier versions cached student/trainer records (incl. guardian phone numbers)
// in the browser and showed them even when the server had no such record.
const LEGACY_STORAGE_KEYS = ["xello_registered_students_v1", "xello_registered_teachers_v1"];

export function AppShell({ currentUser, istToday, ephemeralStorage = false, children }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    try {
      for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up then.
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
      >
        Skip to main content
      </a>
      <Sidebar currentRole={currentUser.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header currentUser={currentUser} istToday={istToday} />

        {/* Bottom padding keeps content clear of the phone navigation bar. */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-3 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-10 focus:outline-none">
          {ephemeralStorage && (
            <div className="mx-auto mb-4 max-w-7xl">
              <Notice tone="warning" title="Temporary storage">
                This deployment runs on a bundled database copy. Changes can disappear after a restart. Connect a persistent
                database before entering real records.
              </Notice>
            </div>
          )}
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        <MobileBottomNav currentRole={currentUser.role} moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} />
        <MobileMoreDrawer currentUser={currentUser} isOpen={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}
