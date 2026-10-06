"use client";

import { useRef, useState } from "react";
import { X, BookPlus, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, ClientApiError, errorMessage } from "@/lib/client-api";
import { ModalShell } from "@/components/ui/ModalShell";
import { FieldError } from "@/components/ui/FormFeedback";

const PALETTE = [
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Purple", hex: "#8b5cf6" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Orange", hex: "#f97316" },
  { name: "Teal", hex: "#14b8a6" },
];

interface QuickAddSubjectModalProps {
  onClose: () => void;
  onSuccess: (newSubject: { id: string; name: string; code: string; color: string }) => void;
}

export function QuickAddSubjectModal({
  onClose,
  onSuccess,
}: QuickAddSubjectModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Academic");
  const [selectedColor, setSelectedColor] = useState(PALETTE[0].hex);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const submittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!name.trim()) {
      setFieldErrors({ name: "Subject name is required." });
      setErrorMsg("Please enter a subject name.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setErrorMsg("");
    setFieldErrors({});

    try {
      const data = await apiRequest<{ subject: { id: string; name: string; code: string; color: string } }>("/api/subjects", {
        method: "POST",
        body: {
          name: name.trim(),
          code: code.trim() || undefined,
          category,
          color: selectedColor,
        },
      });
      onSuccess(data.subject);
      onClose();
    } catch (err) {
      setFieldErrors(err instanceof ClientApiError ? err.fieldErrors : {});
      setErrorMsg(errorMessage(err, "Failed to save new subject."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <ModalShell labelledBy="quick-subject-title" onClose={onClose} closeDisabled={loading} zIndex="z-[60]" maxWidth="max-w-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-2 text-teal-400">
              <BookPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 id="quick-subject-title" className="text-base font-bold text-white">Add New Subject</h3>
              <p className="text-xs text-slate-400">Create a custom academic subject manually</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-touch-target flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 text-xs text-rose-300 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!code) {
                  // Suggest short code
                  const s = e.target.value.trim().toUpperCase();
                  if (s.length >= 2) {
                    const words = s.split(/\s+/);
                    if (words.length >= 2) {
                      setCode(words.map((w) => w[0]).join("").slice(0, 4));
                    }
                  }
                }
              }}
              placeholder="e.g. Statistics, Robotics, Sociology, French"
              aria-invalid={!!fieldErrors.name}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 font-medium focus:border-teal-500 focus:outline-hidden"
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Short Code (Optional)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. STAT, ROB"
                maxLength={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 font-mono font-bold focus:border-teal-500 focus:outline-hidden"
              />
              <FieldError message={fieldErrors.code} />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-medium focus:border-teal-500 focus:outline-hidden"
              >
                <option value="Academic">Academic</option>
                <option value="Science">Science</option>
                <option value="Commerce">Commerce</option>
                <option value="Language">Language</option>
                <option value="Humanities">Humanities</option>
                <option value="Skills">Skills / Coding</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Subject Badge Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((p) => (
                <button
                  type="button"
                  key={p.hex}
                  onClick={() => setSelectedColor(p.hex)}
                  className={`h-7 w-7 rounded-full transition-transform ${
                    selectedColor === p.hex
                      ? "ring-2 ring-white scale-110 shadow-lg"
                      : "opacity-80 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ backgroundColor: p.hex }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save & Add Subject
                </>
              )}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
