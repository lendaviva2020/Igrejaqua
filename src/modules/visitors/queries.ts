import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FOLLOWUP_KINDS, VISITOR_STATUSES } from "./schemas";

const Row = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  first_visit_on: z.string(),
  source: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(VISITOR_STATUSES),
  visit_followups: z.array(z.object({ id: z.string().uuid(), kind: z.enum(FOLLOWUP_KINDS), note: z.string(), done_on: z.string() })),
});
export type VisitorItem = z.infer<typeof Row>;

export async function listVisitors(churchId: string): Promise<readonly VisitorItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("visitors").select("id, full_name, phone, email, first_visit_on, source, notes, status, visit_followups(id, kind, note, done_on)").eq("church_id", churchId).order("first_visit_on", { ascending: false }).limit(200);
  if (error) throw new Error(`Falha ao listar visitantes: ${error.message}`);
  return z.array(Row).parse(data).map((v) => ({ ...v, visit_followups: [...v.visit_followups].sort((a, b) => b.done_on.localeCompare(a.done_on)) }));
}
