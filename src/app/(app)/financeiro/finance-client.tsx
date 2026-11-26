"use client";

import { useState } from "react";
import { ActionForm, Field, SelectField } from "@/components/shared/action-form";
import { createCategoryAction, createEntryAction, voidEntryAction } from "@/modules/finance/actions";
import { FINANCE_KINDS, FINANCE_KIND_LABEL, type FinanceKind } from "@/modules/finance/schemas";

export function CategoryForm() {
  return (
    <ActionForm action={createCategoryAction} submitLabel="Criar categoria">
      <Field label="Nome" name="name" placeholder="Ofertas, Aluguel, Energia…" />
      <SelectField label="Tipo" name="kind" defaultValue="entrada">{FINANCE_KINDS.map((k) => <option key={k} value={k}>{FINANCE_KIND_LABEL[k]}</option>)}</SelectField>
    </ActionForm>
  );
}

export function EntryForm({ categories, today }: { readonly categories: readonly { id: string; name: string; kind: FinanceKind }[]; readonly today: string }) {
  const [kind, setKind] = useState<FinanceKind>("entrada");
  return (
    <ActionForm action={createEntryAction} submitLabel="Lançar">
      <SelectField label="Tipo" name="kind" value={kind} onChange={(e) => setKind(e.target.value === "saida" ? "saida" : "entrada")}>{FINANCE_KINDS.map((k) => <option key={k} value={k}>{FINANCE_KIND_LABEL[k]}</option>)}</SelectField>
      <SelectField label="Categoria" name="categoryId" defaultValue="">
        <option value="" disabled>Escolha…</option>
        {categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
      <Field label="Data" name="occurredOn" type="date" max={today} defaultValue={today} />
      <Field label="Valor (R$)" name="amount" inputMode="decimal" placeholder="1.250,00" />
      <Field label="Descrição" name="description" />
      <Field label="Nº do recibo/nota (opcional)" name="reference" />
    </ActionForm>
  );
}

/** Estorno exige motivo; lançamentos nunca são editados nem apagados. */
export function VoidEntryForm({ entryId }: { readonly entryId: string }) {
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ambar-claro">Estornar</summary>
      <ActionForm action={voidEntryAction} submitLabel="Confirmar estorno" extra={{ entryId }} className="mt-2 flex w-64 flex-col gap-3">
        <Field label="Motivo" name="reason" />
      </ActionForm>
    </details>
  );
}
