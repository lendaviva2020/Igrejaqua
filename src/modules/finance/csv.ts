import type { EntryItem } from "./queries";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escapa uma célula CSV (RFC 4180) e neutraliza injeção de fórmula em planilhas (OWASP CSV injection). */
export function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const cents = (n: number): string => `${Math.trunc(n / 100)},${String(Math.abs(n % 100)).padStart(2, "0")}`;

/** CSV com separador `;` e BOM (abre direto no Excel pt-BR). Lançamentos anulados saem marcados, nunca omitidos. */
export function entriesToCsv(entries: readonly EntryItem[]): string {
  const header = ["Data", "Tipo", "Categoria", "Descrição", "Referência", "Valor (R$)", "Situação", "Motivo da anulação"];
  const rows = entries.map((e) => [
    e.occurred_on, e.kind === "entrada" ? "Entrada" : "Saída", e.finance_categories.name, e.description, e.reference ?? "", cents(e.amount_cents),
    e.voided_at === null ? "Válido" : "Anulado", e.voided_reason ?? "",
  ].map(csvCell).join(";"));
  return `﻿${[header.join(";"), ...rows].join("\r\n")}\r\n`;
}
