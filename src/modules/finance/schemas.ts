import { z } from "zod";
import { parseMoneyToCents } from "./money";

export const FINANCE_KINDS = ["entrada", "saida"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];
export const FINANCE_KIND_LABEL: Record<FinanceKind, string> = { entrada: "Entrada", saida: "Saída" };

export const CreateCategorySchema = z.object({ name: z.string().trim().min(1, "Informe o nome").max(80), kind: z.enum(FINANCE_KINDS) }).strict();

export const CreateEntrySchema = z.object({
  kind: z.enum(FINANCE_KINDS),
  categoryId: z.string().uuid("Escolha a categoria"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD"),
  amount: z.string().transform((v, ctx) => {
    const cents = parseMoneyToCents(v);
    if (cents === null) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 1.250,00" });
    return cents ?? 0;
  }),
  description: z.string().trim().min(1, "Descreva o lançamento").max(200),
  reference: z.string().trim().max(60).optional(),
}).strict();

export const VoidEntrySchema = z.object({ entryId: z.string().uuid(), reason: z.string().trim().min(3, "Informe o motivo").max(200) }).strict();
export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
