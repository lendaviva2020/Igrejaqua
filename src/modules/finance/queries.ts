import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FINANCE_KINDS } from "./schemas";

const Category = z.object({ id: z.string().uuid(), name: z.string(), kind: z.enum(FINANCE_KINDS), active: z.boolean() });
export type CategoryItem = z.infer<typeof Category>;
const Entry = z.object({
  id: z.string().uuid(), kind: z.enum(FINANCE_KINDS), occurred_on: z.string(), amount_cents: z.number().int(), description: z.string(), reference: z.string().nullable(),
  voided_at: z.string().nullable(), voided_reason: z.string().nullable(), finance_categories: z.object({ name: z.string() }),
});
export type EntryItem = z.infer<typeof Entry>;
const Summary = z.object({ category_id: z.string().uuid(), category_name: z.string(), kind: z.enum(FINANCE_KINDS), total_cents: z.number(), entries: z.number() });
export type SummaryRow = z.infer<typeof Summary>;

export async function listCategories(churchId: string): Promise<readonly CategoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("finance_categories").select("id, name, kind, active").eq("church_id", churchId).order("kind").order("name");
  if (error) throw new Error(`Falha ao listar categorias: ${error.message}`);
  return z.array(Category).parse(data);
}

/** `month` no formato AAAA-MM (validado pelo chamador). */
export async function listEntries(churchId: string, year: number, month: number): Promise<readonly EntryItem[]> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("finance_entries").select("id, kind, occurred_on, amount_cents, description, reference, voided_at, voided_reason, finance_categories(name)")
    .eq("church_id", churchId).gte("occurred_on", from).lt("occurred_on", next).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(`Falha ao listar lançamentos: ${error.message}`);
  return z.array(Entry).parse(data);
}

export async function getMonthSummary(churchId: string, year: number, month: number): Promise<readonly SummaryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("finance_month_summary", { p_church: churchId, p_year: year, p_month: month });
  if (error) throw new Error(`Falha ao calcular o resumo: ${error.message}`);
  return z.array(Summary).parse(data);
}
