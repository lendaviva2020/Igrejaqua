import { describe, expect, it } from "vitest";
import { csvCell, entriesToCsv } from "@/modules/finance/csv";
import type { EntryItem } from "@/modules/finance/queries";

const entry = (over: Partial<EntryItem>): EntryItem => ({
  id: "6f1c2a52-8d0a-4c11-9d58-0f5f1b7a2c11", kind: "entrada", occurred_on: "2026-11-02", amount_cents: 123456, description: "Oferta", reference: null,
  voided_at: null, voided_reason: null, finance_categories: { name: "Ofertas" }, ...over,
});

describe("csv do livro-caixa", () => {
  it("neutraliza injeção de fórmula e escapa aspas/separador", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("a;b")).toBe("\"a;b\"");
    expect(csvCell("simples")).toBe("simples");
  });
  it("gera BOM, cabeçalho, valor em reais e marca anulados", () => {
    const csv = entriesToCsv([entry({}), entry({ kind: "saida", amount_cents: 5, voided_at: "2026-11-03T10:00:00Z", voided_reason: "Erro de digitação" })]);
    expect(csv.startsWith("﻿Data;Tipo;")).toBe(true);
    expect(csv).toContain("2026-11-02;Entrada;Ofertas;Oferta;;1234,56;Válido;");
    expect(csv).toContain("Saída;Ofertas;Oferta;;0,05;Anulado;Erro de digitação");
  });
});
