"use client";

import { useEffect } from "react";

/**
 * Full-screen dialog overlay. The overlay scrolls, and the inner wrapper is
 * min-h-full, so dialogs taller than the screen (long forms on phones) can be
 * scrolled from top to bottom instead of being clipped at the top.
 */
export function ModalShell({
  labelledBy,
  onClose,
  closeDisabled = false,
  zIndex = "z-50",
  maxWidth = "max-w-2xl",
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  closeDisabled?: boolean;
  zIndex?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, closeDisabled]);

  return (
    <div className={`fixed inset-0 ${zIndex} overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md`}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`relative w-full ${maxWidth} rounded-3xl bg-[#0c1220] p-5 sm:p-7 shadow-2xl border border-slate-800 text-white my-4 animate-in fade-in zoom-in-95 duration-150`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
