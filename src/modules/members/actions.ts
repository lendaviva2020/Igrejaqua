"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { publicEnv } from "@/lib/env";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChangeRoleSchema, InviteSchema, RevokeInviteSchema, SetStatusSchema } from "./schemas";
import { generateInviteToken, hashInviteToken } from "./token";

/** O link (com o token em claro) é devolvido UMA vez; no banco fica só o hash. Envio por e-mail ainda não existe: o admin compartilha o link. */
export async function inviteMemberAction(input: unknown): Promise<Result<{ link: string; expiresInDays: number }>> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "member.invite")) return fail("FORBIDDEN", "Apenas a administração pode convidar.");
  if (!(await allow(`invite:${ctx.userId}`, 20, 3600))) return fail("RATE_LIMITED", "Muitos convites em pouco tempo.");
  const token = generateInviteToken();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("church_invitations").insert({ church_id: ctx.churchId, email: parsed.data.email, role: parsed.data.role, token_hash: hashInviteToken(token), invited_by: ctx.userId });
  if (error) return fromPostgrestError(error);
  revalidatePath("/membros");
  return ok({ link: `${publicEnv().NEXT_PUBLIC_SITE_URL}/selecionar-igreja?convite=${token}`, expiresInDays: 7 });
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
