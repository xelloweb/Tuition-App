"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Field, controlBorder, controlClass } from "@/components/ui/Field";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { BASES, Basis, methodLabel, quickRanges, rupees } from "@/lib/accounts-shared";
import type { ProfitAndLoss } from "@/lib/services/accounts";
import { ExpenseDialog, ExpenseRow } from "./ExpenseDialog";

const formatDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

export function AccountsClient({ pnl, today, rangeError }: { pnl: ProfitAndLoss; today: string; rangeError: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(pnl.from);
  const [to, setTo] = useState(pnl.to);
  const [basis, setBasis] = useState<Basis>(pnl.basis);
  const [tab, setTab] = useState<"expenses" | "sales">("expenses");
  const [editing, setEditing] = useState<ExpenseRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [banner, setBanner] = useState("");

  const query = (f: string, t: string, b: Basis) => `/accounts?from=${f}&to=${t}&basis=${b}`;
  const show = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(query(from, to, basis));
  };
  const profit = pnl.profit >= 0;
  const period = pnl.from === pnl.to ? formatDay(pnl.from) : `${formatDay(pnl.from)} – ${formatDay(pnl.to)}`;

  const removeExpense = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await apiRequest<{ message: string }>(`/api/expenses/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setBanner(res.message);
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err, "The expense could not be deleted."));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Sales, expenses and profit & loss for any dates. All dates are in IST; amounts in rupees."
        actions={
          <Button type="button" icon={Plus} onClick={() => setEditing("new")}>
            Add expense
          </Button>
        }
      />

      {banner && (
        <Notice tone="success" onDismiss={() => setBanner("")}>
          {banner}
        </Notice>
      )}
      {rangeError && <Notice tone="warning">{rangeError} Showing this month instead.</Notice>}

      <form onSubmit={show} className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5" aria-label="Choose the period">
        <div className="flex flex-wrap gap-2">
          {quickRanges(today).map((r) => {
            const active = r.from === pnl.from && r.to === pnl.to;
            return (
              <Link
                key={r.key}
                href={query(r.from, r.to, pnl.basis)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-control border px-3 text-sm font-semibold ${active ? "border-brand bg-brand/10 text-ink" : "border-line-strong text-ink-muted hover:bg-raised"}`}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <Field label="From">{(p) => <input {...p} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}</Field>
          <Field label="To">{(p) => <input {...p} type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className={`${controlClass} ${controlBorder(false)}`} />}</Field>
          <Field label="Count sales and costs by">
            {(p) => (
              <select {...p} value={basis} onChange={(e) => setBasis(e.target.value as Basis)} className={`${controlClass} ${controlBorder(false)}`}>
                {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            )}
          </Field>
          <Button type="submit">Show</Button>
        </div>
      </form>

      <section aria-labelledby="pnl-summary" className="space-y-3">
        <h2 id="pnl-summary" className="text-lg font-semibold text-ink">
          Profit &amp; loss <span className="text-sm font-normal text-ink-muted">· {period}</span>
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label={pnl.income.label} value={rupees(pnl.income.amount)} sub={`${pnl.income.count} ${pnl.basis === "CASH" ? "payment" : "invoice"}${pnl.income.count === 1 ? "" : "s"}`} />
          <Card label={pnl.trainerPay.label} value={rupees(pnl.trainerPay.amount)} sub={`${pnl.trainerPay.count} class${pnl.trainerPay.count === 1 ? "" : "es"}`} />
          <Card label="Other expenses" value={rupees(pnl.expenses.amount)} sub={`${pnl.expenses.count} expense${pnl.expenses.count === 1 ? "" : "s"}`} />
          <Card
            label={profit ? "Profit" : "Loss"}
            value={rupees(pnl.profit)}
            sub={pnl.income.amount ? `${Math.round((pnl.profit / pnl.income.amount) * 100)}% of ${pnl.basis === "CASH" ? "fees received" : "fees invoiced"}` : "No income in this period"}
            tone={profit ? "good" : "bad"}
          />
        </dl>
        {pnl.notes.length > 0 && (
          <Notice tone="info" title="What is not counted">
            <ul className="list-disc space-y-1 pl-5">{pnl.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </Notice>
        )}
        {pnl.otherCurrencies.length > 0 && (
          <Notice tone="warning" title="Money in other currencies">
            {pnl.otherCurrencies.map((o) => `${o.currency} ${o.amount.toLocaleString("en-IN")} (${o.count} record${o.count === 1 ? "" : "s"})`).join(", ")} is listed under Sales but not added to the
            rupee totals above.
          </Notice>
        )}
      </section>

      <section aria-labelledby="pnl-statement" className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pnl-statement" className="text-lg font-semibold text-ink">Statement</h2>
          <a
            href={`/api/accounts/export?from=${pnl.from}&to=${pnl.to}&basis=${pnl.basis}`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
          </a>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-line">
            <StatementRow label={pnl.income.label} amount={pnl.income.amount} strong />
            <StatementRow label={`Less: ${pnl.trainerPay.label.toLowerCase()}`} amount={-pnl.trainerPay.amount} />
            {pnl.expenses.byCategory.map((c) => (
              <StatementRow key={c.category} label={`Less: ${c.category}`} amount={-c.amount} />
            ))}
            {pnl.expenses.byCategory.length === 0 && <StatementRow label="Less: other expenses" amount={0} />}
            <StatementRow label="Total costs" amount={-pnl.totalCosts} strong />
            <StatementRow label={profit ? "Profit" : "Loss"} amount={pnl.profit} strong tone={profit ? "good" : "bad"} />
          </tbody>
        </table>
      </section>

      {pnl.months.length > 1 && (
        <section aria-labelledby="pnl-months" className="rounded-card border border-line bg-surface p-4 sm:p-5">
          <h2 id="pnl-months" className="text-lg font-semibold text-ink">Month by month</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Month</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Income</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Trainer pay</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Expenses</th>
                  <th scope="col" className="py-2 text-right font-medium">Profit / loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {pnl.months.map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{m.label}</th>
                    <td className="py-2 pr-3 text-right text-ink">{rupees(m.income)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{rupees(m.trainerPay)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{rupees(m.expenses)}</td>
                    <td className={`py-2 text-right font-semibold ${m.profit >= 0 ? "text-success" : "text-danger"}`}>{rupees(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <div role="tablist" aria-label="Records in this period" className="flex gap-2 border-b border-line">
          {(
            [
              ["expenses", `Expenses (${pnl.expenseRows.length})`],
              ["sales", `Sales (${pnl.sales.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px min-h-[44px] border-b-2 px-3 text-sm font-semibold ${tab === key ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "expenses" ? (
          pnl.expenseRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No expenses in this period. Use “Add expense” to record one.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pnl.expenseRows.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-ink break-words">
                      {e.description} <span className="font-normal text-ink-muted">· {e.category}</span>
                    </p>
                    <p className="text-ink-muted">
                      {formatDay(e.spentOn)} · <span className="font-mono">{e.expenseNumber}</span> · {methodLabel(e.paymentMethod)}
                      {e.paidTo ? ` · to ${e.paidTo}` : ""}
                      {e.reference ? ` · ref ${e.reference}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="font-semibold tabular-nums text-ink">{rupees(e.amount)}</span>
                    <Button type="button" variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(e)} aria-label={`Edit ${e.expenseNumber}`}>
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={() => { setDeleteError(""); setDeleting(e); }} aria-label={`Delete ${e.expenseNumber}`}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : pnl.sales.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">No {pnl.basis === "CASH" ? "payments received" : "invoices issued"} in this period.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pnl.sales.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/students/${s.studentId}?tab=billing`} className="font-semibold text-ink underline-offset-2 hover:underline break-words">
                    {s.studentName}
                  </Link>{" "}
                  <span className="font-mono text-ink-muted">({s.studentCode})</span>
                  <p className="text-ink-muted">
                    {formatDay(s.date)} · <span className="font-mono">{s.number}</span> · {pnl.basis === "CASH" ? methodLabel(s.detail) : s.detail.replace("_", " ").toLowerCase()}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-ink">{s.currency === "INR" ? rupees(s.amount) : `${s.currency} ${s.amount.toLocaleString("en-IN")}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ExpenseDialog
          expense={editing === "new" ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setBanner(message);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          title="Delete expense"
          message="Delete this expense? Only for one entered by mistake. The audit log keeps a copy."
          itemName={`${deleting.expenseNumber} · ${rupees(deleting.amount)}`}
          itemDetails={`${formatDay(deleting.spentOn)} · ${deleting.category}: ${deleting.description}`}
          confirmLabel="Delete expense"
          loading={deleteBusy}
          errorMessage={deleteError}
          onConfirm={removeExpense}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`rounded-card border bg-surface p-3 sm:p-4 ${tone === "good" ? "border-success/40" : tone === "bad" ? "border-danger/40" : "border-line"}`}>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-ink"}`}>{value}</dd>
      <dd className="mt-0.5 text-xs text-ink-subtle">{sub}</dd>
    </div>
  );
}

function StatementRow({ label, amount, strong, tone }: { label: string; amount: number; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <tr>
      <th scope="row" className={`py-2 pr-3 text-left ${strong ? "font-semibold text-ink" : "font-normal text-ink-muted"}`}>{label}</th>
      <td className={`py-2 text-right tabular-nums ${strong ? "font-semibold" : ""} ${tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-ink"}`}>{rupees(amount)}</td>
    </tr>
  );
}
