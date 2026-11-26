"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeclareUnavailabilitySchema, RemoveUnavailabilitySchema } from "./schemas";

export async function declareUnavailabilityAction(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = DeclareUnavailabilitySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const weekdays = parsed.data.weekdays && parsed.data.weekdays.length > 0 && parsed.data.weekdays.length < 7 ? [...new Set(parsed.data.weekdays)].sort() : null;
  const { data, error } = await supabase
    .from("unavailabilities")
    .insert({
      church_id: ctx.churchId,
      membership_id: ctx.membershipId, // sempre o próprio; nunca vem do cliente
      during: `[${parsed.data.from},${parsed.data.to}]`,
      weekdays,
      reason: parsed.data.reason ?? null,
    })
    .select("id")
    .single();
  if (error) return fromPostgrestError(error);
  revalidatePath("/disponibilidade");
  return ok({ id: z.string().uuid().parse((data as { id: unknown }).id) });
}

export async function removeUnavailabilityAction(input: unknown): Promise<Result<{ removed: true }>> {
  const parsed = RemoveUnavailabilitySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Registro inválido.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("unavailabilities").delete().eq("church_id", ctx.churchId).eq("id", parsed.data.id);
  if (error) return fromPostgrestError(error);
  revalidatePath("/disponibilidade");
  return ok({ removed: true });
}
