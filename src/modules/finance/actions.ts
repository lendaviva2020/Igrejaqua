"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateCategorySchema, CreateEntrySchema, VoidEntrySchema } from "./schemas";

export async function createCategoryAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateCategorySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração acessa o financeiro.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("finance_categories").insert({ church_id: ctx.churchId, name: parsed.data.name, kind: parsed.data.kind });
  if (error) return error.code === "23505" ? fail("CONFLICT", "Já existe uma categoria com este nome.", { name: ["Nome já em uso"] }) : fromPostgrestError(error);
  revalidatePath("/financeiro");
  return ok({ created: true });
}

/** Livro-caixa da igreja: não registra quem deu (sem dado por pessoa). Lançamento só é corrigido por estorno. */
export async function createEntryAction(input: unknown): Promise<Result<{ created: true }>> {
  const parsed = CreateEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração acessa o financeiro.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("finance_entries").insert({
    church_id: ctx.churchId,
    kind: parsed.data.kind,
    category_id: parsed.data.categoryId,
    occurred_on: parsed.data.occurredOn,
    amount_cents: parsed.data.amount,
    description: parsed.data.description,
    reference: parsed.data.reference ?? null,
    created_by_membership_id: ctx.membershipId,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/financeiro");
  return ok({ created: true });
}

export async function voidEntryAction(input: unknown): Promise<Result<{ voided: true }>> {
  const parsed = VoidEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração acessa o financeiro.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("finance_entries").update({ voided_at: new Date().toISOString(), voided_reason: parsed.data.reason, voided_by_membership_id: ctx.membershipId })
    .eq("church_id", ctx.churchId).eq("id", parsed.data.entryId).is("voided_at", null).select("id");
  if (error) return fromPostgrestError(error);
  if (data.length === 0) return fail("NOT_FOUND", "Lançamento não encontrado ou já estornado.");
  revalidatePath("/financeiro");
  return ok({ voided: true });
}
