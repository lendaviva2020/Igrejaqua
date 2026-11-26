import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({
  id: z.string().uuid(), kind: z.enum(["announcement", "devotional"]), title: z.string(), body_md: z.string(), status: z.enum(["draft", "scheduled", "published", "archived"]),
  audience: z.enum(["church", "ministry"]), ministry_id: z.string().uuid().nullable(), scripture_ref: z.string().nullable(), published_at: z.string().nullable(), publish_at: z.string().nullable(), created_at: z.string(),
});
export type ContentItem = z.infer<typeof Row>;

/** RLS decide o que cada pessoa enxerga (publicados do público dela + rascunhos de quem gerencia). */
export async function listContent(churchId: string): Promise<readonly ContentItem[]> {
  const supabase = await createSupabaseServerClient();
  // Publica o que já venceu (complementa o pg_cron; falha aqui não impede a listagem).
  await supabase.rpc("publish_due_content", { p_church: churchId });
  const { data, error } = await supabase
    .from("announcements_and_devotionals")
    .select("id, kind, title, body_md, status, audience, ministry_id, scripture_ref, published_at, publish_at, created_at")
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(100);
  if (error) throw new Error(`Falha ao listar comunicados: ${error.message}`);
  return z.array(Row).parse(data);
}

const ReadingRow = z.object({ title: z.string(), scripture_ref: z.string() });
export type DailyReading = z.infer<typeof ReadingRow>;

/** Referência do devocional publicado mais recente (a RLS já filtra pelo público de quem lê); nenhum texto é inventado. */
export async function getLatestDevotionalReading(churchId: string): Promise<DailyReading | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements_and_devotionals")
    .select("title, scripture_ref")
    .eq("church_id", churchId)
    .eq("kind", "devotional")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("scripture_ref", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar a leitura do dia: ${error.message}`);
  if (data === null) return null;
  const parsed = ReadingRow.safeParse(data);
  return parsed.success ? parsed.data : null;
}
