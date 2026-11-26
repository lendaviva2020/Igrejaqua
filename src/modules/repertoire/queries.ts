import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SongRowSchema, VersionRowSchema, type SongRow, type VersionRow } from "./schemas";

export async function listSongs(churchId: string): Promise<readonly SongRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("songs")
    .select("id, title, artist, default_key")
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .order("title", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Falha ao listar músicas: ${error.message}`);
  return z.array(SongRowSchema).parse(data);
}

export async function getDefaultVersionBySong(churchId: string, songId: string): Promise<VersionRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("song_versions")
    .select("id, song_id, label, original_key, chordpro, bpm, capo, songs(title, artist, copyright_notice)")
    .eq("church_id", churchId)
    .eq("song_id", songId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar versão: ${error.message}`);
  return data === null ? null : VersionRowSchema.parse(data);
}

export async function getVersion(churchId: string, versionId: string): Promise<VersionRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("song_versions")
    .select("id, song_id, label, original_key, chordpro, bpm, capo, songs(title, artist, copyright_notice)")
    .eq("church_id", churchId)
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar versão: ${error.message}`);
  return data === null ? null : VersionRowSchema.parse(data);
}
