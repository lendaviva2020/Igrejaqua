"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RunSchema = z.object({ runId: z.string().uuid(), eventId: z.string().uuid() }).strict();

/** Aceite humano: transforma a sugestão validada em setlist (o banco revalida permissão, músicas e setlist vazio). */
export async function acceptRepertoireDraftAction(input: unknown): Promise<Result<{ songs: number }>> {
  const parsed = RunSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Sugestão inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "setlist.manage")) return fail("FORBIDDEN", "Você não monta repertório nesta igreja.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("ai_accept_repertoire_run", { p_run: parsed.data.runId });
  if (error) return fail(error.code === "42501" ? "FORBIDDEN" : "RULE_VIOLATION", error.code === "23514" ? error.message : "Não foi possível usar esta sugestão.");
  revalidatePath(`/agenda/${parsed.data.eventId}`);
  return ok({ songs: z.number().int().parse(data) });
}

export async function discardRepertoireDraftAction(input: unknown): Promise<Result<{ discarded: true }>> {
  const parsed = RunSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Sugestão inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "setlist.manage")) return fail("FORBIDDEN", "Você não monta repertório nesta igreja.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ai_discard_repertoire_run", { p_run: parsed.data.runId });
  if (error) return fail("RULE_VIOLATION", "Não foi possível descartar esta sugestão.");
  revalidatePath(`/agenda/${parsed.data.eventId}`);
  return ok({ discarded: true });
}
