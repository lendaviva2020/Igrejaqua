"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddFollowupSchema, CreateVisitorSchema, SetVisitorStatusSchema, VisitorIdSchema } from "./schemas";

export async function createVisitorAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateVisitorSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "visitor.manage")) return fail("FORBIDDEN", "Apenas quem gerencia membros de um ministério cadastra visitantes.");
  const supabase = await createSupabaseServerClient();
  const hasContact = parsed.data.phone !== undefined || parsed.data.email !== undefined;
  const { error } = await supabase.from("visitors").insert({
    church_id: ctx.churchId,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    contact_consent_at: hasContact ? new Date().toISOString() : null,
    source: parsed.data.source ?? null,
    notes: parsed.data.notes ?? null,
    ...(parsed.data.firstVisitOn === undefined ? {} : { first_visit_on: parsed.data.firstVisitOn }),
    assigned_membership_id: ctx.membershipId,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/visitantes");
  return ok({ created: true });
}

export async function setVisitorStatusAction(input: unknown): Promise<Result<{ updated: true }>> {
  const parsed = SetVisitorStatusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "visitor.manage")) return fail("FORBIDDEN", "Sem permissão para alterar visitantes.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("visitors").update({ status: parsed.data.status }).eq("church_id", ctx.churchId).eq("id", parsed.data.visitorId).select("id");
  if (error) return fromPostgrestError(error);
  if (data.length === 0) return fail("NOT_FOUND", "Visitante não encontrado.");
  revalidatePath("/visitantes");
  return ok({ updated: true });
}

export async function addFollowupAction(input: unknown): Promise<Result<{ added: true }>> {
  const parsed = AddFollowupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "visitor.manage")) return fail("FORBIDDEN", "Sem permissão para registrar contatos.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("visit_followups").insert({
    church_id: ctx.churchId,
    visitor_id: parsed.data.visitorId,
    kind: parsed.data.kind,
    note: parsed.data.note,
    by_membership_id: ctx.membershipId,
    ...(parsed.data.doneOn === undefined ? {} : { done_on: parsed.data.doneOn }),
  });
  if (error) return fromPostgrestError(error);
  // Primeiro contato tira o visitante de "novo" (a RLS garante que só quem pode editar consegue)
  await supabase.from("visitors").update({ status: "em_acompanhamento" }).eq("church_id", ctx.churchId).eq("id", parsed.data.visitorId).eq("status", "novo");
  revalidatePath("/visitantes");
  return ok({ added: true });
}

/** Direito ao apagamento (LGPD): só a administração; acompanhamentos saem junto (cascata). */
export async function deleteVisitorAction(input: unknown): Promise<Result<{ deleted: true }>> {
  const parsed = VisitorIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Visitante inválido.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "visitor.delete")) return fail("FORBIDDEN", "Apenas a administração apaga visitantes.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("visitors").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.visitorId).select("id");
  if (error) return fromPostgrestError(error);
  if (data.length === 0) return fail("NOT_FOUND", "Visitante não encontrado.");
  revalidatePath("/visitantes");
  return ok({ deleted: true });
}
