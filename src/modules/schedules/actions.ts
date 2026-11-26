"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddLineupSchema, LineupIdSchema, PublishSchema, RespondSchema } from "./schemas";

export async function addLineupAction(input: unknown): Promise<Result<{ lineupId: string }>> {
  const parsed = AddLineupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "schedule.edit", parsed.data.ministryId)) return fail("FORBIDDEN", "Você não pode editar a escala deste ministério.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_lineup")
    .insert({
      church_id: ctx.churchId,
      session_id: parsed.data.sessionId,
      ministry_id: parsed.data.ministryId,
      ministry_membership_id: parsed.data.ministryMembershipId,
      function: parsed.data.function,
      override_reason: parsed.data.overrideReason ?? null,
      source: "manual",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return fromPostgrestError(error);
  revalidatePath("/agenda", "layout");
  return ok({ lineupId: z.string().uuid().parse((data as { id: unknown }).id) });
}

export async function removeLineupAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = LineupIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Escala inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data: row, error: readErr } = await supabase.from("event_lineup").select("ministry_id, status").eq("church_id", ctx.churchId).eq("id", parsed.data.lineupId).maybeSingle();
  if (readErr) return fromPostgrestError(readErr);
  if (row === null) return fail("NOT_FOUND", "Escala não encontrada.");
  const ministryId = z.string().uuid().parse((row as { ministry_id: unknown }).ministry_id);
  if (!can(ctx, "schedule.edit", ministryId)) return fail("FORBIDDEN", "Você não pode editar a escala deste ministério.");
  // Após publicada, o correto é cancelar (mantém histórico e notifica); só rascunho é apagado.
  const status = String((row as { status: unknown }).status);
  const { error } = status === "draft"
    ? await supabase.from("event_lineup").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.lineupId)
    : await supabase.from("event_lineup").update({ status: "cancelled" }).eq("church_id", ctx.churchId).eq("id", parsed.data.lineupId);
  if (error) return fromPostgrestError(error);
  revalidatePath("/agenda", "layout");
  return ok({ removed: true });
}

/** Publica todos os rascunhos do ministério na sessão. Exige publish_schedule (checado aqui e por trigger). */
export async function publishLineupAction(input: unknown): Promise<Result<{ published: number }>> {
  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "schedule.publish", parsed.data.ministryId)) return fail("FORBIDDEN", "Você não pode publicar a escala deste ministério.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_lineup")
    .update({ status: "published" })
    .eq("church_id", ctx.churchId)
    .eq("session_id", parsed.data.sessionId)
    .eq("ministry_id", parsed.data.ministryId)
    .eq("status", "draft")
    .select("id");
  if (error) return fromPostgrestError(error);
  const published = (data as unknown[]).length;
  if (published === 0) return fail("RULE_VIOLATION", "Não há rascunhos para publicar.");
  revalidatePath("/agenda", "layout");
  revalidatePath("/dashboard");
  return ok({ published });
}

export async function respondLineupAction(input: unknown): Promise<Result<{ status: "confirmed" | "declined" }>> {
  const parsed = RespondSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Resposta inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_lineup")
    .update({ status: parsed.data.response })
    .eq("church_id", ctx.churchId)
    .eq("id", parsed.data.lineupId)
    .select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Escala não encontrada para você.");
  revalidatePath("/dashboard");
  revalidatePath("/agenda", "layout");
  return ok({ status: parsed.data.response });
}
