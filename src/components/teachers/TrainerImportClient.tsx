"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, RotateCcw, UserPlus } from "lucide-react";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { readTrainerSheet, toImportPayload, TrainerCandidate } from "@/lib/trainer-import";
import { formatDays } from "@/lib/trainer-profile";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";

type RowStatus = "ready" | "created" | "exists" | "invalid";
interface ServerRow {
  index: number;
  name: string;
  status: RowStatus;
  messages: string[];
}
interface ImportResponse {
  dryRun: boolean;
  created: number;
  results: ServerRow[];
}
interface PreviewRow {
  candidate: TrainerCandidate;
  status: RowStatus;
  messages: string[];
}

const STATUS_LABEL: Record<RowStatus, { text: string; cls: string }> = {
  ready: { text: "Ready to add", cls: "border-emerald-400/40 text-success" },
  created: { text: "Added", cls: "border-emerald-400/40 text-success" },
  exists: { text: "Already in the app", cls: "border-line-strong text-ink-muted" },
  invalid: { text: "Needs fixing", cls: "border-rose-400/50 text-danger" },
};

export function TrainerImportClient() {
  const router = useRouter();
  const busy = useRef(false);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"paste" | "preview" | "done">("paste");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [skippedHeader, setSkippedHeader] = useState(false);
  const [filter, setFilter] = useState<"all" | RowStatus>("all");
  const [working, setWorking] = useState<"" | "checking" | "importing">("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState(0);

  /** Rows without local problems go to the server; results map back by position in that list. */
  const send = async (candidates: TrainerCandidate[], dryRun: boolean) => {
    const sendable = candidates.filter((c) => c.problems.length === 0);
    const data: ImportResponse = sendable.length
      ? await apiRequest<ImportResponse>("/api/teachers/import", { method: "POST", body: { dryRun, rows: sendable.map(toImportPayload) } })
      : { dryRun, created: 0, results: [] };
    const byLine = new Map(sendable.map((c, i) => [c.line, data.results.find((r) => r.index === i)]));
    return {
      created: data.created,
      rows: candidates.map((c) => {
        if (c.problems.length) return { candidate: c, status: "invalid" as RowStatus, messages: c.problems };
        const r = byLine.get(c.line);
        return { candidate: c, status: r?.status ?? "invalid", messages: r?.messages ?? ["Not checked."] };
      }),
    };
  };

  const check = async () => {
    if (busy.current) return;
    setError("");
    const read = readTrainerSheet(text);
    if (read.error) return setError(read.error);
    busy.current = true;
    setWorking("checking");
    try {
      const result = await send(read.candidates, true);
      setRows(result.rows);
      setSkippedHeader(read.skippedHeader);
      setFilter("all");
      setStage("preview");
    } catch (err) {
      setError(errorMessage(err, "Could not check the rows."));
    } finally {
      busy.current = false;
      setWorking("");
    }
  };

  const ready = rows.filter((r) => r.status === "ready");
  const importReady = async () => {
    if (busy.current || ready.length === 0) return;
    if (!confirm(`Add ${ready.length} trainer${ready.length === 1 ? "" : "s"}? They become active and can be assigned to students. No logins are created and no messages are sent.`)) return;
    busy.current = true;
    setWorking("importing");
    setError("");
    try {
      const result = await send(ready.map((r) => r.candidate), false);
      const byLine = new Map(result.rows.map((r) => [r.candidate.line, r]));
      setRows((prev) => prev.map((r) => byLine.get(r.candidate.line) ?? r));
      setCreated(result.created);
      setStage("done");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Nothing was added. Check the rows again and retry."));
    } finally {
      busy.current = false;
      setWorking("");
    }
  };

  const counts = useMemo(() => {
    const c = { ready: 0, created: 0, exists: 0, invalid: 0 } as Record<RowStatus, number>;
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-5">
      <Link href="/teachers" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-text">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Trainers
      </Link>
      <PageHeader
        title="Import trainers from Google Sheet"
        context="Trainers"
        description="Add many trainers at once from the sign-up form's response sheet. You see every row before anything is saved."
      />
      {error && <Notice tone="error">{error}</Notice>}

      {stage === "paste" && (
        <section className="space-y-3 rounded-card border border-line bg-surface p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>Open the trainer sign-up responses in Google Sheets.</li>
            <li>Select the trainer rows (including the header row is fine) and copy them.</li>
            <li>Paste them below and choose “Check rows”.</li>
          </ol>
          <Notice tone="info" title="Bank details are ignored">
            The bank column is skipped in your browser: it is not uploaded or saved. Keep bank details in the sheet.
          </Notice>
          <label htmlFor="import-text" className="block text-sm font-semibold text-ink-muted">
            Rows copied from the sheet
          </label>
          <textarea
            id="import-text"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="w-full rounded-control border border-line-strong bg-raised p-3 font-mono text-base sm:text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
          <Button icon={FileSpreadsheet} loading={working === "checking"} onClick={check} disabled={!text.trim()}>
            Check rows
          </Button>
        </section>
      )}

      {stage !== "paste" && (
        <section className="space-y-4">
          {stage === "done" ? (
            <Notice tone="success" title={`${created} trainer${created === 1 ? "" : "s"} added`}>
              <p>
                They are active and appear on the Trainers page. Pay rates start at the standard ₹500/hour; the owner can change
                each one with Edit. Rows marked “Needs fixing” were not added: correct them in the sheet and import again (people
                already added are skipped automatically).
              </p>
            </Notice>
          ) : (
            <p className="text-sm text-ink-muted">
              {rows.length} row{rows.length === 1 ? "" : "s"} read{skippedHeader ? " (header row skipped)" : ""}. Nothing has been saved yet.
            </p>
          )}

          <div className="flex flex-wrap gap-2" role="group" aria-label="Show rows">
            {(["all", stage === "done" ? "created" : "ready", "exists", "invalid"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-[44px] rounded-control border px-3 text-sm font-semibold ${filter === f ? "border-brand bg-brand/15 text-brand-text" : "border-line-strong text-ink-muted hover:bg-raised"}`}
              >
                {f === "all" ? `All (${rows.length})` : `${STATUS_LABEL[f].text} (${counts[f]})`}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {shown.map(({ candidate: c, status, messages }) => (
              <li key={c.line} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-ink break-words">
                    <span className="mr-2 text-sm font-normal text-ink-subtle">Row {c.line}</span>
                    {c.name || "(no name)"}
                  </p>
                  <span className={`rounded-full border px-2.5 py-0.5 text-sm ${STATUS_LABEL[status].cls}`}>{STATUS_LABEL[status].text}</span>
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2"><dt className="text-ink-subtle">Phone</dt><dd className="text-ink">{c.phone || "—"}</dd></div>
                  <div className="flex min-w-0 gap-2"><dt className="text-ink-subtle">Email</dt><dd className="min-w-0 break-all text-ink">{c.email || "—"}</dd></div>
                  <div className="flex gap-2 sm:col-span-2"><dt className="text-ink-subtle">Subjects</dt><dd className="text-ink">{c.subjects.join(", ") || "—"}</dd></div>
                  <div className="flex gap-2 sm:col-span-2"><dt className="text-ink-subtle">Classes</dt><dd className="text-ink">{c.grades.join(", ") || "—"}</dd></div>
                  {c.location && <div className="flex gap-2"><dt className="text-ink-subtle">Place</dt><dd className="text-ink">{c.location}</dd></div>}
                  {(c.availableDays.length > 0 || c.availableTimes) && (
                    <div className="flex gap-2"><dt className="text-ink-subtle">Available</dt><dd className="text-ink">{[formatDays(c.availableDays), c.availableTimes].filter(Boolean).join(" · ")}</dd></div>
                  )}
                  {c.whatsapp && <div className="flex gap-2"><dt className="text-ink-subtle">WhatsApp</dt><dd className="text-ink">{c.whatsapp}</dd></div>}
                </dl>
                {messages.length > 0 && (
                  <ul className={`mt-2 list-disc space-y-0.5 pl-5 text-sm ${status === "invalid" ? "text-danger" : "text-ink-muted"}`}>
                    {messages.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                )}
                {c.warnings.length > 0 && status !== "invalid" && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-warning">
                    {c.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="sticky bottom-20 flex flex-wrap gap-2 rounded-card border border-line bg-surface p-3 lg:bottom-4">
            {stage === "preview" && (
              <Button icon={UserPlus} loading={working === "importing"} disabled={ready.length === 0} onClick={importReady}>
                Add {ready.length} trainer{ready.length === 1 ? "" : "s"}
              </Button>
            )}
            {stage === "done" && (
              <Link href="/teachers" className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-brand-ink hover:bg-brand-hover">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Go to trainers
              </Link>
            )}
            <Button variant="outline" icon={RotateCcw} onClick={() => { setStage("paste"); setRows([]); setError(""); }} disabled={!!working}>
              {stage === "done" ? "Import more" : "Change the pasted rows"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
