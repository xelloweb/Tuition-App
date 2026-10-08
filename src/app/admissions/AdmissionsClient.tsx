"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Copy, ExternalLink, Inbox, MessageCircle, Search } from "lucide-react";
import { ALL_GRADES } from "@/lib/grades";
import { INTAKE_STATUSES } from "@/lib/intake";
import { formatInTimeZone } from "@/lib/timezones";
import type { SubmissionListItem } from "@/lib/services/parent-submissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { controlBorder, controlClass } from "@/components/ui/Field";

const STATUS_TONE: Record<string, string> = {
  NEW: "border-brand/60 text-brand-text",
  CONTACTED: "border-info/60 text-info",
  AWAITING_INFO: "border-warning/60 text-warning",
  READY: "border-success/60 text-success",
  CONVERTED: "border-success/60 text-success",
  CLOSED: "border-line-strong text-ink-muted",
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.CLOSED}`}>{label}</span>;
}

const gradeLabel = (value: string) => ALL_GRADES.find((g) => g.value === value)?.label ?? value;

export function AdmissionsClient({
  link,
  privacyConfigured,
  items,
  total,
  filter,
  counts,
}: {
  link: { url: string; fromSetting: boolean };
  privacyConfigured: boolean;
  items: SubmissionListItem[];
  total: number;
  filter: { status: string; assigned: string; q: string };
  counts: Record<string, number>;
}) {
  const [copyState, setCopyState] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);
  const shareText = `Hello from Xello Tuition! Please share your child's details for admission using this form: ${link.url}\nIt takes about 5 minutes. All class timings are in Indian Standard Time (IST).`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const openCount = (counts.NEW ?? 0) + (counts.CONTACTED ?? 0) + (counts.AWAITING_INFO ?? 0) + (counts.READY ?? 0);
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyState("Link copied. Paste it into a message to the parent.");
    } catch {
      linkRef.current?.select();
      setCopyState("Copying is blocked in this browser: the link is selected, copy it from the box.");
    }
  };

  const statusOptions = [
    { value: "OPEN", label: `Open (${openCount})` },
    { value: "ALL", label: `All (${allCount})` },
    ...INTAKE_STATUSES.map((s) => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description="Share the parent form, then review what parents send and start each admission from it. Nothing is booked until you confirm an admission."
      />

      <section aria-labelledby="form-link-heading" className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5">
        <h2 id="form-link-heading" className="text-lg font-semibold text-ink">Admission form link</h2>
        <p className="text-sm text-ink-muted">Parents fill in the form themselves, without a login. It shows only the form, never any records.</p>
        {!privacyConfigured && (
          <Notice tone="warning" title="Launch blocker: no privacy notice">
            The form must link to Xello&apos;s approved privacy notice before parents use it. Publish the notice, add its web address as
            PRIVACY_NOTICE_URL in Hostinger → Environment variables, and redeploy. Until then the live form says “not open yet”, and
            copying or sharing the link is switched off.
          </Notice>
        )}
        <div>
          <label htmlFor="form-link" className="mb-1 block text-sm font-semibold text-ink-muted">Link to send to parents</label>
          <input
            id="form-link"
            ref={linkRef}
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${controlClass} ${controlBorder(false)} font-mono`}
          />
          {!link.fromSetting && (
            <p className="mt-1 text-xs text-ink-subtle">Taken from this visit&apos;s address because the site address setting (NEXTAUTH_URL) is not set.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" icon={Copy} onClick={copy} disabled={!privacyConfigured}>
            Copy admission form link
          </Button>
          <a
            href="/admission/apply"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-raised"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open form preview<span className="sr-only"> (opens in a new tab)</span>
          </a>
          {privacyConfigured ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-raised"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Share on WhatsApp<span className="sr-only"> (opens WhatsApp; you choose who to send it to)</span>
            </a>
          ) : (
            <Button type="button" variant="outline" icon={MessageCircle} disabled>
              Share on WhatsApp
            </Button>
          )}
        </div>
        <p role="status" className="text-sm text-ink-muted">{copyState}</p>
        <p className="text-xs text-ink-subtle">WhatsApp opens with a ready message; you pick the parent and press send. Nothing is sent automatically.</p>
      </section>

      <section aria-labelledby="submissions-heading" className="space-y-3">
        <h2 id="submissions-heading" className="text-lg font-semibold text-ink">Parent submissions</h2>
        <form method="get" action="/admissions" className="grid gap-3 rounded-card border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end sm:p-4">
          <div>
            <label htmlFor="filter-status" className="mb-1 block text-sm font-semibold text-ink-muted">Status</label>
            <select id="filter-status" name="status" defaultValue={filter.status} className={`${controlClass} ${controlBorder(false)}`}>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-assigned" className="mb-1 block text-sm font-semibold text-ink-muted">Assigned to</label>
            <select id="filter-assigned" name="assigned" defaultValue={filter.assigned} className={`${controlClass} ${controlBorder(false)}`}>
              <option value="ANY">Anyone</option>
              <option value="ME">Me</option>
              <option value="UNASSIGNED">Nobody yet</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-q" className="mb-1 block text-sm font-semibold text-ink-muted">Search</label>
            <input id="filter-q" name="q" type="search" defaultValue={filter.q} placeholder="Name, reference, phone or subject" className={`${controlClass} ${controlBorder(false)}`} />
          </div>
          <Button type="submit" icon={Search}>Show</Button>
        </form>

        <p className="text-sm text-ink-muted" aria-live="polite">
          {total === 0 ? "No parent submissions match." : `${total} submission${total === 1 ? "" : "s"}${total > items.length ? `, showing the latest ${items.length}` : ""}. Times are IST.`}
        </p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong p-8 text-center">
            <Inbox className="h-8 w-8 text-ink-subtle" aria-hidden="true" />
            <p className="text-ink-muted">{allCount === 0 ? "No parent has used the form yet." : "Nothing here with these filters."}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    {s.unread && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink">Unread</span>}
                    <span className="font-mono text-ink">{s.reference}</span>
                    <span>· {formatInTimeZone(s.createdAt)} IST</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.flags.map((f) => (
                      <span key={f} className="rounded-full border border-warning/60 px-2.5 py-0.5 text-xs font-semibold text-warning">{f}</span>
                    ))}
                    <StatusChip status={s.status} label={s.statusLabel} />
                  </div>
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink">
                  <Link href={`/admissions/${s.id}`} className="underline-offset-2 hover:underline">
                    {s.studentName}
                  </Link>
                </h3>
                <p className="text-sm text-ink-muted">{gradeLabel(s.grade)} · {s.board}</p>
                <p className="text-sm text-ink">Subjects: {s.subjectNames}</p>
                <p className="text-sm text-ink">
                  Parent: {s.guardianName} · <span className="font-mono">{s.whatsappNumber}</span>
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {s.assignedToName ? `Assigned to ${s.assignedToName}` : "Not assigned"}
                  {s.followUpOn ? ` · Follow up on ${s.followUpOn}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
