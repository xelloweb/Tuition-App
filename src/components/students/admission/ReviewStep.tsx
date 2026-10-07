"use client";

import { Pencil } from "lucide-react";
import { Notice } from "@/components/ui/Notice";
import { displayTime } from "./WeeklyScheduleStep";

export interface ReviewData {
  student: { name: string; grade: string; board: string; medium: string; status?: string };
  guardian: { name: string; whatsapp: string; email: string; country: string; siblingOf?: string | null };
  subjects: { name: string; trainer: string | null }[];
  pkg: null | { name: string; totalCredits: number; price: number; startDate: string; expiryDate: string; allocations: { subject: string; credits: number }[] };
  schedule: null | { subject: string; items: { day: string; start: string; end: string; trainer: string | null }[] }[];
  booking: null | { weeklySlots: number; bookedClasses: number; notBooked: string[] };
  warnings: string[];
}

function Section({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-brand-text hover:bg-raised"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-0.5 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{value || "—"}</dd>
    </div>
  );
}

const formatDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";

export function ReviewStep({ data, onEdit }: { data: ReviewData; onEdit: (stepId: string) => void }) {
  return (
    <div className="space-y-3">
      {data.warnings.length > 0 && (
        <Notice tone="warning" title="Check before confirming">
          <ul className="list-disc space-y-0.5 pl-5">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Section title="Student" onEdit={() => onEdit("details")}>
        <dl>
          <Row label="Name" value={data.student.name} />
          <Row label="Class / grade" value={data.student.grade} />
          <Row label="Board" value={data.student.board} />
          <Row label="Medium" value={data.student.medium} />
          {data.student.status && <Row label="Status" value={data.student.status} />}
        </dl>
      </Section>

      <Section title="Parent / guardian" onEdit={() => onEdit("details")}>
        <dl>
          <Row label="Name" value={data.guardian.name} />
          <Row label="WhatsApp" value={data.guardian.whatsapp} />
          <Row label="Email" value={data.guardian.email} />
          <Row label="Country" value={data.guardian.country} />
          {data.guardian.siblingOf && <Row label="Sibling of" value={data.guardian.siblingOf} />}
        </dl>
      </Section>

      <Section title="Subjects & trainers" onEdit={() => onEdit("subjects")}>
        {data.subjects.length === 0 ? (
          <p className="text-sm text-ink-subtle">No subjects.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.subjects.map((s) => (
              <li key={s.name} className="flex flex-wrap justify-between gap-2">
                <span className="text-ink">{s.name}</span>
                <span className={s.trainer ? "text-ink-muted" : "text-warning"}>{s.trainer ?? "Trainer not assigned yet"}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Package & fees" onEdit={() => onEdit("package")}>
        {data.pkg ? (
          <dl>
            <Row label="Package" value={data.pkg.name} />
            <Row label="Classes" value={`${data.pkg.totalCredits} in total`} />
            <Row label="Price" value={<span className="tabular-nums">₹{data.pkg.price.toLocaleString("en-IN")} (INR)</span>} />
            <Row label="Valid" value={`${formatDate(data.pkg.startDate)}${data.pkg.expiryDate ? ` to ${formatDate(data.pkg.expiryDate)}` : ", no expiry"}`} />
            <Row label="Per subject" value={data.pkg.allocations.map((a) => `${a.subject}: ${a.credits}`).join(" · ")} />
            {data.pkg.price > 0 && <Row label="Invoice" value="An unpaid invoice is created, due in 14 days." />}
          </dl>
        ) : (
          <p className="text-sm text-ink-subtle">No package now. Classes cannot be booked until a package is added.</p>
        )}
      </Section>

      {data.schedule && (
        <Section title="Weekly schedule (IST)" onEdit={() => onEdit("schedule")}>
          {data.schedule.every((g) => g.items.length === 0) ? (
            <p className="text-sm text-ink-subtle">No weekly slots. You can add them later from the student&apos;s timetable.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.schedule.map((g) => (
                <li key={g.subject}>
                  <p className="font-semibold text-ink">{g.subject}</p>
                  {g.items.length === 0 ? (
                    <p className="text-ink-subtle">No slots</p>
                  ) : (
                    <ul className="text-ink-muted">
                      {g.items.map((it, i) => (
                        <li key={i}>
                          {it.day} {displayTime(it.start)}–{displayTime(it.end)}
                          {it.trainer ? ` · ${it.trainer}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data.booking && (
            <p className="mt-3 text-sm text-ink">
              <strong>{data.booking.bookedClasses}</strong> class{data.booking.bookedClasses === 1 ? "" : "es"} will be booked for the next 4 weeks.
            </p>
          )}
          {data.booking && data.booking.notBooked.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-warning">
              {data.booking.notBooked.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
