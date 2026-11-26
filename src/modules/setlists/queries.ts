import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({
  id: z.string().uuid(), session_id: z.string().uuid(), position: z.number(), target_key: z.string().nullable(), song_version_id: z.string().uuid(),
  song_versions: z.object({ songs: z.object({ title: z.string() }) }),
});
export interface SetlistEntry { readonly id: string; readonly sessionId: string; readonly versionId: string; readonly title: string; readonly targetKey: string | null }

export async function listSetlists(churchId: string, sessionIds: readonly string[]): Promise<readonly SetlistEntry[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_setlist")
    .select("id, session_id, position, target_key, song_version_id, song_versions!inner(songs!inner(title))")
    .eq("church_id", churchId)
    .in("session_id", [...sessionIds])
    .order("position");
  if (error) throw new Error(`Falha ao listar setlist: ${error.message}`);
  return z.array(Row).parse(data).map((r) => ({ id: r.id, sessionId: r.session_id, versionId: r.song_version_id, title: r.song_versions.songs.title, targetKey: r.target_key }));
}

const VersionOpt = z.object({ id: z.string().uuid(), songs: z.object({ title: z.string() }) });
export interface VersionOption { readonly versionId: string; readonly title: string }

export async function listPublishedVersionOptions(churchId: string): Promise<readonly VersionOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("song_versions").select("id, songs!inner(title)").eq("church_id", churchId).eq("is_default", true).eq("status", "published").limit(500);
  if (error) throw new Error(`Falha ao listar versões: ${error.message}`);
  return z.array(VersionOpt).parse(data).map((v) => ({ versionId: v.id, title: v.songs.title })).sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}
