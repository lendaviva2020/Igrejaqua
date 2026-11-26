"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddMinistryMemberSchema, RemoveMinistryMemberSchema, SetPermissionSchema, UpdateMinistryMemberSchema } from "./member-schemas";

const page = (ministryId: string): string => `/ministerios/${ministryId}`;

export async function addMinistryMemberAction(input: unknown): Promise<Result<{ added: true }>> {
  const parsed = AddMinistryMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const d = parsed.data;
  if (!can(ctx, "ministry.members.manage", d.ministryId)) return fail("FORBIDDEN", "Você não gerencia os integrantes deste ministério.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ministry_memberships").insert({
    church_id: ctx.churchId, ministry_id: d.ministryId, membership_id: d.membershipId, role: d.role, instruments: d.instruments, voice_part: d.voicePart ?? null,
  });
  if (error) return error.code === "23505" ? fail("CONFLICT", "Esta pessoa já integra o ministério.") : fromPostgrestError(error);
  revalidatePath(page(d.ministryId));
  revalidatePath("/ministerios");
  return ok({ added: true });
}

export async function updateMinistryMemberAction(input: unknown): Promise<Result<{ updated: true }>> {
  const parsed = UpdateMinistryMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const d = parsed.data;
  if (!can(ctx, "ministry.members.manage", d.ministryId)) return fail("FORBIDDEN", "Você não gerencia os integrantes deste ministério.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ministry_memberships")
    .update({ role: d.role, active: d.active, instruments: d.instruments, voice_part: d.voicePart })
    .eq("church_id", ctx.churchId).eq("ministry_id", d.ministryId).eq("id", d.ministryMembershipId).select("id");
  if (error) return fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Integrante não encontrado.");
  revalidatePath(page(d.ministryId));
  return ok({ updated: true });
}

export async function removeMinistryMemberAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = RemoveMinistryMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  const d = parsed.data;
  if (!can(ctx, "ministry.members.manage", d.ministryId)) return fail("FORBIDDEN", "Você não gerencia os integrantes deste ministério.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ministry_memberships").delete()
    .eq("church_id", ctx.churchId).eq("ministry_id", d.ministryId).eq("id", d.ministryMembershipId).select("id");
  if (error) return error.code === "23503" ? fail("RULE_VIOLATION", "Esta pessoa tem escalas neste ministério. Desative-a em vez de remover.") : fromPostgrestError(error);
  if ((data as unknown[]).length === 0) return fail("NOT_FOUND", "Integrante não encontrado.");
  revalidatePath(page(d.ministryId));
  revalidatePath("/ministerios");
  return ok({ removed: true });
}

/** Anti-escalada no banco (ministry_permissions_guard): só concede o que possui, nunca a si mesmo. */
export async function setMinistryPermissionAction(input: unknown): Promise<Result<{ granted: boolean }>> {
  const parsed = SetPermissionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  const d = parsed.data;
  if (!can(ctx, "ministry.permissions.grant", d.ministryId)) return fail("FORBIDDEN", "Você não pode conceder permissões neste ministério.");
  const supabase = await createSupabaseServerClient();
  if (d.granted) {
    const { error } = await supabase.from("ministry_permissions").insert({ church_id: ctx.churchId, ministry_id: d.ministryId, ministry_membership_id: d.ministryMembershipId, permission: d.permission });
    if (error && error.code !== "23505") return error.code === "42501" ? fail("FORBIDDEN", "Não é possível conceder esta permissão (você não a possui ou é a sua própria).") : fromPostgrestError(error);
  } else {
    const { error } = await supabase.from("ministry_permissions").delete()
      .eq("church_id", ctx.churchId).eq("ministry_id", d.ministryId).eq("ministry_membership_id", d.ministryMembershipId).eq("permission", d.permission);
    if (error) return error.code === "42501" ? fail("FORBIDDEN", "Não é possível revogar as próprias permissões.") : fromPostgrestError(error);
  }
  revalidatePath(page(d.ministryId));
  return ok({ granted: d.granted });
}
