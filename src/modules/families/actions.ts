"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddFamilyMemberSchema, CreateFamilySchema, FamilyIdSchema, FamilyMemberIdSchema } from "./schemas";

export async function createFamilyAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateFamilySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "family.manage")) return fail("FORBIDDEN", "Apenas a administração gerencia famílias.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("families").insert({ church_id: ctx.churchId, name: parsed.data.name });
  if (error) return fromPostgrestError(error);
  revalidatePath("/familias");
  return ok({ created: true });
}

export async function addFamilyMemberAction(input: unknown): Promise<Result<{ added: true }>> {
  const parsed = AddFamilyMemberSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "family.manage")) return fail("FORBIDDEN", "Apenas a administração gerencia famílias.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("family_members").insert({
    church_id: ctx.churchId,
    family_id: parsed.data.familyId,
    membership_id: parsed.data.membershipId ?? null,
    full_name: parsed.data.fullName ?? null,
    relation: parsed.data.relation,
    birth_date: parsed.data.birthDate ?? null,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/familias");
  return ok({ added: true });
}

export async function removeFamilyMemberAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = FamilyMemberIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Registro inválido.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "family.manage")) return fail("FORBIDDEN", "Apenas a administração gerencia famílias.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("family_members").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.id);
  if (error) return fromPostgrestError(error);
  revalidatePath("/familias");
  return ok({ removed: true });
}

export async function deleteFamilyAction(input: unknown): Promise<Result<{ deleted: true }>> {
  const parsed = FamilyIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Família inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "family.manage")) return fail("FORBIDDEN", "Apenas a administração gerencia famílias.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("families").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.familyId);
  if (error) return fromPostgrestError(error);
  revalidatePath("/familias");
  return ok({ deleted: true });
}
