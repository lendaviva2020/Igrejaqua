"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseChordPro, ChordProError } from "@/lib/chords/chordpro";
import { getLibrarySong } from "./library/catalog";

const AddSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/, "Música inválida") }).strict();

/**
 * Adiciona uma música da Biblioteca aberta ao repertório da igreja. O conteúdo vem do catálogo do
 * servidor (nunca do cliente): o cliente só informa o id. Crédito e licença vão para
 * songs.copyright_notice (exibidos na página da música), como as licenças CC exigem.
 */
export async function addLibrarySongAction(input: unknown): Promise<Result<{ songId: string }>> {
  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Música inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "repertoire.manage")) return fail("FORBIDDEN", "Você não pode gerenciar o repertório.");
  const song = getLibrarySong(parsed.data.id);
  if (song === null) return fail("NOT_FOUND", "Música não encontrada na biblioteca.");
  try {
    parseChordPro(song.chordpro);
  } catch (e) {
    if (e instanceof ChordProError) return fail("VALIDATION", "A cifra desta música não pôde ser lida.");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_song", {
    p_church: ctx.churchId,
    p_title: song.title,
    p_artist: song.writer,
    p_key: song.key,
    p_chordpro: song.chordpro,
    p_bpm: song.bpm,
    p_reference_url: song.sourceUrl,
  });
  if (error) return fromPostgrestError(error);
  const songId = String(data);
  // Crédito e licença (CC exige em toda cópia). RLS: só quem gerencia o repertório atualiza.
  const { error: noticeError } = await supabase.from("songs").update({ copyright_notice: song.copyrightNotice }).eq("church_id", ctx.churchId).eq("id", songId);
  if (noticeError) {
    // Sem o crédito a música não pode ficar (exigência da licença): desfaz com exclusão lógica
    // (songs usa deleted_at e a versão referencia a música).
    await supabase.from("songs").update({ deleted_at: new Date().toISOString() }).eq("church_id", ctx.churchId).eq("id", songId);
    return fromPostgrestError(noticeError);
  }
  revalidatePath("/repertorio");
  return ok({ songId });
}
