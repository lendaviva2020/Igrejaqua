"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext, requireUser } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AI_CONSENT_VERSION, CreateDsrSchema, ResolveDsrSchema, SetChurchAiSchema, UpdateChurchSchema, UpdateProfileSchema } from "./schemas";

export async function updateProfileAction(input: unknown): Promise<Result<{ updated: true }>> {
  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName, display_name: parsed.data.displayName ? parsed.data.displayName : null, phone: parsed.data.phone ? parsed.data.phone : null,
  }).eq("id", user.id).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Perfil não encontrado.");
  revalidatePath("/configuracoes");
  return ok({ updated: true });
}

export async function updateChurchAction(input: unknown): Promise<Result<{ updated: true }>> {
  const parsed = UpdateChurchSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "church.settings.update")) return fail("FORBIDDEN", "Apenas a administração altera os dados da igreja.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("churches").update({
    name: parsed.data.name, legal_name: parsed.data.legalName ? parsed.data.legalName : null,
    document_number: parsed.data.documentNumber ? parsed.data.documentNumber : null, timezone: parsed.data.timezone,
  }).eq("id", ctx.churchId).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Igreja não encontrada.");
  revalidatePath("/", "layout");
  return ok({ updated: true });
}

/** Pedido do titular (LGPD art. 18): prazo de 15 dias definido no banco; o administrador da igreja responde. */
export async function createDsrAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateDsrSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!(await allow(`dsr:${ctx.userId}`, 5, 86400))) return fail("RATE_LIMITED", "Limite diário de pedidos atingido.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("data_subject_requests").insert({ church_id: ctx.churchId, user_id: ctx.userId, kind: parsed.data.kind, details: parsed.data.details ? parsed.data.details : null });
  if (error) return fromPostgrestError(error);
  revalidatePath("/configuracoes");
  return ok({ created: true });
}

export async function resolveDsrAction(input: unknown): Promise<Result<{ status: string }>> {
  const parsed = ResolveDsrSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "church.settings.update")) return fail("FORBIDDEN", "Apenas a administração responde a pedidos.");
  const supabase = await createSupabaseServerClient();
  const finished = parsed.data.status !== "in_progress";
  const { data, error } = await supabase.from("data_subject_requests")
    .update({ status: parsed.data.status, resolved_at: finished ? new Date().toISOString() : null, handled_by: ctx.userId })
    .eq("church_id", ctx.churchId).eq("id", parsed.data.requestId).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Pedido não encontrado.");
  revalidatePath("/configuracoes");
  return ok({ status: parsed.data.status });
}

/** Liga/desliga a IA da igreja. Só a administração; o banco registra o consentimento (set_church_ai). */
export async function setChurchAiAction(input: unknown): Promise<Result<{ enabled: boolean }>> {
  const parsed = SetChurchAiSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Confirme o aviso para ativar a IA.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "church.settings.update")) return fail("FORBIDDEN", "Apenas a administração altera o uso de IA.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_church_ai", { p_church: ctx.churchId, p_enabled: parsed.data.enabled, p_consent_version: AI_CONSENT_VERSION });
  if (error) return fromPostgrestError(error);
  revalidatePath("/configuracoes");
  revalidatePath("/agenda", "layout");
  return ok({ enabled: parsed.data.enabled });
}
