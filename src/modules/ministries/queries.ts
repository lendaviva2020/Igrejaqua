import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MinistryRow = z.object({ id: z.string().uuid(), name: z.string(), description: z.string().nullable(), ministry_memberships: z.array(z.object({ id: z.string() })) });
export interface MinistrySummary { readonly id: string; readonly name: string; readonly description: string | null; readonly memberCount: number }

export async function listMinistries(churchId: string): Promise<readonly MinistrySummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ministries")
    .select("id, name, description, ministry_memberships(id)")
    .eq("church_id", churchId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao listar ministérios: ${error.message}`);
  return z.array(MinistryRow).parse(data).map((m) => ({ id: m.id, name: m.name, description: m.description, memberCount: m.ministry_memberships.length }));
}
