"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { AppUrlNotConfiguredError } from "@/lib/app-url";
import { getAppBaseUrl } from "@/lib/app-url.server";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChangeRoleSchema, DecideJoinSchema, InviteSchema, RevokeInviteSchema, SetStatusSchema } from "./schemas";
import { generateInviteToken, hashInviteToken, invitationUrl, joinLinkUrl } from "./token";

/** Base pública antes de gravar qualquer token: sem ela, nenhum link quebrado é criado. */
async function baseUrlOrFail(): Promise<string | null> {
  try {
    return await getAppBaseUrl();
  } catch (e) {
    if (e instanceof AppUrlNotConfiguredError) { console.error("app_url_not_configured"); return null; }
    throw e;
  }
}

const URL_NOT_CONFIGURED = "O endereço público do sistema não está configurado. Peça ao responsável técnico para definir NEXT_PUBLIC_SITE_URL.";

/** O link (com o token em claro) é devolvido UMA vez; no banco fica só o hash. Envio por e-mail ainda não existe: o admin compartilha o link. */
export async function inviteMemberAction(input: unknown): Promise<Result<{ link: string; expiresInDays: number }>> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração pode convidar.");
  if (!(await allow(`invite:${ctx.userId}`, 20, 3600))) return fail("RATE_LIMITED", "Muitos convites em pouco tempo.");
  const base = await baseUrlOrFail();
  if (base === null) return fail("UNAVAILABLE", URL_NOT_CONFIGURED);
  const token = generateInviteToken();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("church_invitations").insert({ church_id: ctx.churchId, email: parsed.data.email, role: parsed.data.role, token_hash: hashInviteToken(token), invited_by: ctx.userId });
  if (error) return fromPostgrestError(error);
  revalidatePath("/membros");
  return ok({ link: invitationUrl(base, token), expiresInDays: 7 });
}

export async function revokeInvitationAction(input: unknown): Promise<Result<{ revoked: true }>> {
  const parsed = RevokeInviteSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Convite inválido.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração pode revogar convites.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_invitations").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.invitationId).is("accepted_at", null).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Convite não encontrado.");
  revalidatePath("/membros");
  return ok({ revoked: true });
}

/** Gera (ou troca) o link geral da igreja. O anterior para de funcionar na hora. */
export async function rotateJoinLinkAction(): Promise<Result<{ link: string }>> {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração gera o link da igreja.");
  if (!(await allow(`join-link:${ctx.userId}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas trocas de link em pouco tempo.");
  const base = await baseUrlOrFail();
  if (base === null) return fail("UNAVAILABLE", URL_NOT_CONFIGURED);
  const token = generateInviteToken();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rotate_church_join_link", { p_church: ctx.churchId, p_token: token });
  if (error) return fromPostgrestError(error);
  revalidatePath("/membros");
  return ok({ link: joinLinkUrl(base, token) });
}

export async function disableJoinLinkAction(): Promise<Result<{ disabled: true }>> {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração desativa o link da igreja.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("disable_church_join_link", { p_church: ctx.churchId });
  if (error) return fromPostgrestError(error);
  revalidatePath("/membros");
  return ok({ disabled: true });
}

/** Aprova (vira membro ativo) ou recusa (status "left"; a pessoa pode pedir de novo) um pedido de entrada. */
export async function decideJoinRequestAction(input: unknown): Promise<Result<{ status: "active" | "left" }>> {
  const parsed = DecideJoinSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração aprova pedidos.");
  const status = parsed.data.approve ? "active" : "left";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_memberships").update({ status }).eq("church_id", ctx.churchId).eq("id", parsed.data.membershipId).eq("status", "pending").select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Pedido não encontrado ou já decidido.");
  revalidatePath("/membros");
  return ok({ status });
}

export async function changeMemberRoleAction(input: unknown): Promise<Result<{ role: string }>> {
  const parsed = ChangeRoleSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.role.change")) return fail("FORBIDDEN", "Apenas a administração altera papéis.");
  const supabase = await createSupabaseServerClient();
  // Regras do banco (memberships_guard): não altera o próprio papel e preserva ao menos um admin ativo.
  const { data, error } = await supabase.from("church_memberships").update({ role: parsed.data.role }).eq("church_id", ctx.churchId).eq("id", parsed.data.membershipId).select("id");
  if (error) return error.code === "42501" ? fail("FORBIDDEN", "Não é possível alterar este papel (o seu próprio ou de quem tem uma regra de proteção).") : fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Membro não encontrado.");
  revalidatePath("/membros");
  return ok({ role: parsed.data.role });
}

export async function setMemberStatusAction(input: unknown): Promise<Result<{ status: string }>> {
  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.role.change")) return fail("FORBIDDEN", "Apenas a administração altera o status.");
  if (parsed.data.membershipId === ctx.membershipId) return fail("RULE_VIOLATION", "Você não pode suspender a si mesmo.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_memberships").update({ status: parsed.data.status }).eq("church_id", ctx.churchId).eq("id", parsed.data.membershipId).select("id");
  if (error) return error.code === "42501" ? fail("FORBIDDEN", "Não é possível alterar o status deste membro.") : fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Membro não encontrado.");
  revalidatePath("/membros");
  return ok({ status: parsed.data.status });
}
