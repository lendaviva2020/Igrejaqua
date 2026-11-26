"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseChordPro, ChordProError } from "@/lib/chords/chordpro";
import { CreateSongSchema } from "./schemas";

export async function createSongAction(input: unknown): Promise<Result<{ songId: string }>> {
  const parsed = CreateSongSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "repertoire.manage")) return fail("FORBIDDEN", "Você não pode gerenciar o repertório.");
  try {
    parseChordPro(parsed.data.chordpro);
  } catch (e) {
    if (e instanceof ChordProError) return fail("VALIDATION", e.message, { chordpro: [e.message] });
    throw e;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_song", {
    p_church: ctx.churchId,
    p_title: parsed.data.title,
    p_artist: parsed.data.artist ?? null,
    p_key: parsed.data.originalKey,
    p_chordpro: parsed.data.chordpro,
    p_bpm: parsed.data.bpm ?? null,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/repertorio");
  return ok({ songId: String(data) });
}
