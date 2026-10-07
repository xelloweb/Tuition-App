"use client";
import { useEffect, useRef } from "react";

/**
 * Accessible modal built on the native <dialog> element (showModal):
 * the rest of the page becomes inert, Tab stays inside, Escape closes (unless
 * closing is disabled while saving), focus starts on the first field and
 * returns to the opening control afterwards. The overlay scrolls, so dialogs
 * taller than a phone screen can be read from top to bottom.
 */
export function ModalShell({
  labelledBy,
  onClose,
  closeDisabled = false,
  maxWidth = "max-w-2xl",
  panelClassName,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Kept for existing callers; native modals stack in the top layer automatically. */
  zIndex?: string;
  maxWidth?: string;
  /** Replaces the default dark panel styling (e.g. a white printable invoice). */
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    const firstField = dialog.querySelector<HTMLElement>(
      "[autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );
    firstField?.focus();

    const onCancel = (e: Event) => {
      e.preventDefault(); // the parent decides whether the dialog unmounts
      if (!closeDisabledRef.current) onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-transparent p-0 text-ink backdrop:bg-black/80"
    >
      <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-4">
        <div className={`relative my-4 w-full ${maxWidth} ${panelClassName ?? "rounded-card border border-line bg-surface p-5 shadow-2xl sm:p-7"}`}>
          {children}
        </div>
      </div>
    </dialog>
  );
}
