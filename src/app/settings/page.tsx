import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getCurrentUser } from "@/lib/auth";
import { formatInTimeZone } from "@/lib/timezones";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const AUDIT_LIMIT = 50;

/** Rules the application applies today. New packages get these defaults; they are not editable here. */
const RULES: { label: string; value: string }[] = [
  { label: "Time zone", value: "All dates and times are India Standard Time (IST, UTC+05:30) for everyone, including GCC families." },
  { label: "Class length", value: "Packages created during admission use 60-minute classes; weekly slots must match the package's class length." },
  { label: "Completed class", value: "Uses 1 class from the student's package for that subject." },
  { label: "Student no-show", value: "Uses 1 class (default for new packages)." },
  { label: "Cancellation", value: "Free with at least 4 hours' notice; later cancellations follow the no-show rule (default for new packages)." },
  { label: "Trainer absence", value: "Never uses the student's classes. Arrange a replacement class." },
  { label: "Weekly timetable", value: "Books classes up to 28 days ahead, only while the package has unused classes for that subject." },
  { label: "Overdue", value: "An invoice is overdue only after its due date has passed in IST; payments count only once verified." },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (user.role !== "OWNER" && user.role !== "COORDINATOR") {
    return <AccessDenied message="Settings and the audit log are available to the owner and academic coordinators." />;
  }

  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: AUDIT_LIMIT });
  const owner = canManageUsers(user.role);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings & audit log" description="The rules the app applies, and a record of recent changes." />

      <section aria-labelledby="rules-heading" className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <h2 id="rules-heading" className="text-lg font-semibold text-ink">Class and billing rules</h2>
        <p className="text-sm text-ink-muted">These are built into the app. Ask your developer to change them.</p>
        <dl className="mt-3 divide-y divide-line">
          {RULES.map((r) => (
            <div key={r.label} className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr]">
              <dt className="text-sm font-semibold text-ink">{r.label}</dt>
              <dd className="text-sm text-ink-muted">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {owner && (
        <section aria-labelledby="admin-heading" className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <h2 id="admin-heading" className="text-lg font-semibold text-ink">Logins and backups</h2>
          <ul className="mt-2 space-y-2 text-sm text-ink-muted">
            <li>
              Add staff logins, switch logins off and create password links on{" "}
              <Link href="/users" className="font-semibold text-brand-text underline">Users &amp; logins</Link>.
            </li>
            <li>
              All records live in one database file on the hosting server (folder <span className="font-mono">xello-data</span>). Download a copy
              regularly from Hostinger&apos;s File Manager and keep it somewhere private.
            </li>
          </ul>
        </section>
      )}

      <section aria-labelledby="audit-heading" className="rounded-card border border-line bg-surface">
        <div className="border-b border-line p-4">
          <h2 id="audit-heading" className="text-lg font-semibold text-ink">Audit log</h2>
          <p className="text-sm text-ink-muted">The latest {AUDIT_LIMIT} recorded changes, newest first (IST).</p>
        </div>
        {auditLogs.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {auditLogs.map((log) => (
              <li key={log.id} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-ink">
                    <span className="font-semibold">{log.action.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-ink-muted"> · {log.entityType.toLowerCase()} · by {log.actorName} ({log.actorRole.toLowerCase()})</span>
                  </p>
                  <p className="font-mono text-sm text-ink-subtle">{formatInTimeZone(log.createdAt)} IST</p>
                </div>
                {log.details && (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-control border border-line bg-canvas p-2.5 font-mono text-xs text-ink-muted">{log.details}</pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
