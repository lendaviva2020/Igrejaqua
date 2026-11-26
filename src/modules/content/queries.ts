import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({
  id: z.string().uuid(), kind: z.enum(["announcement", "devotional"]), title: z.string(), body_md: z.string(), status: z.enum(["draft", "scheduled", "published", "archived"]),
  audience: z.enum(["church", "ministry"]), ministry_id: z.string().uuid().nullable(), scripture_ref: z.string().nullable(), published_at: z.string().nullable(), created_at: z.string(),
});
export type ContentItem = z.infer<typeof Row>;

/** RLS decide o que cada pessoa enxerga (publicados do público dela + rascunhos de quem gerencia). */
export async function listContent(churchId: string): Promise<readonly ContentItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements_and_devotionals")
    .select("id, kind, title, body_md, status, audience, ministry_id, scripture_ref, published_at, created_at")
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(100);
  if (error) throw new Error(`Falha ao listar comunicados: ${error.message}`);
  return z.array(Row).parse(data);
}
