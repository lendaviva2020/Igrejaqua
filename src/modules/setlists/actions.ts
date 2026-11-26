"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddSetlistSchema, MoveSetlistSchema, RemoveSetlistSchema, moveInOrder } from "./schemas";

export async function addToSetlistAction(input: unknown): Promise<Result<{ setlistId: string }>> {
  const parsed = AddSetlistSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "setlist.manage")) return fail("FORBIDDEN", "Você não pode montar o repertório do culto.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_to_setlist", { p_session: parsed.data.sessionId, p_version: parsed.data.versionId, p_target_key: parsed.data.targetKey ?? null });
  if (error) return fromPostgrestError(error);
  revalidatePath("/agenda", "layout");
  return ok({ setlistId: z.string().uuid().parse(data) });
}

export async function removeFromSetlistAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = RemoveSetlistSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "setlist.manage")) return fail("FORBIDDEN", "Você não pode editar o repertório do culto.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("event_setlist").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.setlistId).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Item não encontrado.");
  // Compacta posições restantes de forma atômica.
  const { data: rest, error: restErr } = await supabase.from("event_setlist").select("id").eq("church_id", ctx.churchId).eq("session_id", parsed.data.sessionId).order("position");
  if (restErr) return fromPostgrestError(restErr);
  const ids = z.array(z.object({ id: z.string().uuid() })).parse(rest).map((r) => r.id);
  if (ids.length > 0) {
    const { error: reErr } = await supabase.rpc("reorder_setlist", { p_session: parsed.data.sessionId, p_ids: ids });
    if (reErr) return fromPostgrestError(reErr);
  }
  revalidatePath("/agenda", "layout");
  return ok({ removed: true });
}

export async function moveInSetlistAction(input: unknown): Promise<Result<{ moved: true }>> {
  const parsed = MoveSetlistSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "setlist.manage")) return fail("FORBIDDEN", "Você não pode editar o repertório do culto.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("event_setlist").select("id").eq("church_id", ctx.churchId).eq("session_id", parsed.data.sessionId).order("position");
  if (error) return fromPostgrestError(error);
  const ids = z.array(z.object({ id: z.string().uuid() })).parse(data).map((r) => r.id);
  const next = moveInOrder(ids, parsed.data.setlistId, parsed.data.direction);
  if (next === null) return fail("RULE_VIOLATION", "O item já está no limite da lista.");
  const { error: rpcErr } = await supabase.rpc("reorder_setlist", { p_session: parsed.data.sessionId, p_ids: [...next] });
  if (rpcErr) return fromPostgrestError(rpcErr);
  revalidatePath("/agenda", "layout");
  return ok({ moved: true });
}
