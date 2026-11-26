import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { getMonthSummary, listCategories, listEntries } from "@/modules/finance/queries";
import { formatCents } from "@/modules/finance/money";
import { FINANCE_KIND_LABEL, MonthSchema } from "@/modules/finance/schemas";
import { CategoryForm, EntryForm, VoidEntryForm } from "./finance-client";

export const metadata: Metadata = { title: "Financeiro" };
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) notFound();
  const { m } = await searchParams;
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const selected = MonthSchema.safeParse(m).success && m !== undefined ? m : current;
  const [yearText = "", monthText = ""] = selected.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const [categories, entries, summary] = await Promise.all([listCategories(ctx.churchId), listEntries(ctx.churchId, year, month), getMonthSummary(ctx.churchId, year, month)]);
  const totalIn = summary.filter((s) => s.kind === "entrada").reduce((n, s) => n + s.total_cents, 0);
  const totalOut = summary.filter((s) => s.kind === "saida").reduce((n, s) => n + s.total_cents, 0);
  const today = now.toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Financeiro" description="Livro-caixa da igreja: entradas e saídas por categoria. Não registra quem contribuiu." />
      <nav aria-label="Mês" className="mb-6 flex items-center justify-between gap-3">
        <Link href={`/financeiro?m=${shiftMonth(year, month, -1)}`} className="inline-flex min-h-11 items-center rounded-full border border-linha px-4 text-sm font-semibold hover:bg-superficie-2">Mês anterior</Link>
        <p className="text-lg font-semibold capitalize">{monthFmt.format(new Date(Date.UTC(year, month - 1, 1)))}</p>
        <Link href={`/financeiro?m=${shiftMonth(year, month, 1)}`} className="inline-flex min-h-11 items-center rounded-full border border-linha px-4 text-sm font-semibold hover:bg-superficie-2">Próximo mês</Link>
      </nav>
      <dl className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[["Entradas", totalIn], ["Saídas", totalOut], ["Saldo do mês", totalIn - totalOut]].map(([label, value]) => (
          <div key={String(label)} className="rounded-superficie border border-linha bg-superficie p-4"><dt className="text-sm text-texto-2">{label}</dt><dd className="tabular mt-1 text-2xl font-semibold">{formatCents(Number(value))}</dd></div>
        ))}
      </dl>
      <section aria-labelledby="cats" className="mb-10">
        <h2 id="cats" className="mb-3 text-2xl">Por categoria</h2>
        {summary.length === 0 ? <EmptyState title="Nenhuma categoria cadastrada">Crie categorias abaixo para começar a lançar.</EmptyState> : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Totais do mês por categoria</caption>
            <thead><tr className="border-b border-linha text-texto-2"><th scope="col" className="py-2">Categoria</th><th scope="col">Tipo</th><th scope="col" className="text-right">Lançamentos</th><th scope="col" className="text-right">Total</th></tr></thead>
            <tbody>{summary.map((s) => <tr key={s.category_id} className="border-b border-linha"><th scope="row" className="py-2 font-medium">{s.category_name}</th><td>{FINANCE_KIND_LABEL[s.kind]}</td><td className="tabular text-right">{s.entries}</td><td className="tabular text-right">{formatCents(s.total_cents)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="lanc" className="mb-10">
        <h2 id="lanc" className="mb-3 text-2xl">Lançamentos</h2>
        {entries.length === 0 ? <EmptyState title="Sem lançamentos neste mês" /> : (
          <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className={e.voided_at ? "opacity-60" : undefined}>
                  <p className="font-medium">{e.voided_at ? <s>{e.description}</s> : e.description}</p>
                  <p className="text-sm text-texto-2">{dayFmt.format(new Date(`${e.occurred_on}T00:00:00Z`))} · {e.finance_categories.name}{e.reference ? ` · ${e.reference}` : ""}{e.voided_reason ? ` · estornado: ${e.voided_reason}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`tabular font-semibold ${e.kind === "entrada" ? "text-sucesso" : "text-perigo"}`}>{e.kind === "entrada" ? "+" : "−"} {formatCents(e.amount_cents)}</p>
                  {e.voided_at ? null : <VoidEntryForm entryId={e.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="novo"><h2 id="novo" className="mb-3 text-2xl">Novo lançamento</h2><EntryForm categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} today={today} /></section>
        <section aria-labelledby="novacat"><h2 id="novacat" className="mb-3 text-2xl">Nova categoria</h2><CategoryForm /></section>
      </div>
    </>
  );
}
