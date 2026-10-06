"use client";

import { AlertTriangle, RefreshCw, X, Trash2 } from "lucide-react";
import { ModalShell } from "./ModalShell";

interface DeleteConfirmModalProps {
  title: string;
  message: string;
  itemName?: string;
  itemDetails?: string;
  confirmLabel?: string;
  loading?: boolean;
  /** Shown inside the dialog when the server refuses (e.g. record has history). */
  errorMessage?: string | null;
  /** Optional safer alternative, e.g. "Archive instead". */
  alternativeAction?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  title,
  message,
  itemName,
  itemDetails,
  confirmLabel = "Delete",
  loading = false,
  errorMessage,
  alternativeAction,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <ModalShell labelledBy="delete-confirm-title" onClose={onCancel} closeDisabled={loading} maxWidth="max-w-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-2 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 id="delete-confirm-title" className="text-base font-bold text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-touch-target flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 space-y-3 text-xs">
        <p className="text-slate-300 leading-relaxed">{message}</p>

        {itemName && (
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800 space-y-1">
            <span className="font-bold text-white text-sm block">{itemName}</span>
            {itemDetails && <span className="text-slate-400 text-[11px] block">{itemDetails}</span>}
          </div>
        )}

        {errorMessage ? (
          <div role="alert" className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-[11px] text-amber-200">
            {errorMessage}
          </div>
        ) : (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-[11px] text-rose-300">
            ⚠️ This action is permanent and audited in the system logs.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        {alternativeAction && (
          <button
            type="button"
            onClick={alternativeAction.onClick}
            disabled={loading}
            className="rounded-xl px-4 py-2 min-h-[44px] text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {alternativeAction.label}
          </button>
        )}
        {!errorMessage && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 min-h-[44px] text-xs font-bold text-white hover:brightness-110 shadow-lg shadow-rose-500/20 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Working...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {confirmLabel}
              </>
            )}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
