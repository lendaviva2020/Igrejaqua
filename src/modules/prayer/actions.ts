"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { allow } from "@/lib/security/rate-limit";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreatePrayerSchema, ModeratePrayerSchema, PrayActionSchema } from "./schemas";

export async function createPrayerAction(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = CreatePrayerSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!(await allow(`prayer:${ctx.userId}`, 10, 3600))) return fail("RATE_LIMITED", "Muitos pedidos em pouco tempo. Tente mais tarde.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_prayer_request", {
    p_church: ctx.churchId, p_body: parsed.data.body, p_anonymous: parsed.data.anonymous, p_ministry: parsed.data.ministryId ?? null,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/oracao");
  return ok({ id: z.string().uuid().parse(data) });
}

export async function setPrayingAction(input: unknown): Promise<Result<{ praying: boolean }>> {
  const parsed = PrayActionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = parsed.data.praying
    ? await supabase.from("prayer_interactions").upsert({ church_id: ctx.churchId, prayer_request_id: parsed.data.requestId, membership_id: ctx.membershipId }, { onConflict: "church_id,prayer_request_id,membership_id", ignoreDuplicates: true })
    : await supabase.from("prayer_interactions").delete().eq("church_id", ctx.churchId).eq("prayer_request_id", parsed.data.requestId).eq("membership_id", ctx.membershipId);
  if (error) return fromPostgrestError(error);
  revalidatePath("/oracao");
  return ok({ praying: parsed.data.praying });
}

export async function moderatePrayerAction(input: unknown): Promise<Result<{ status: string }>> {
  const parsed = ModeratePrayerSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("moderate_prayer_request", { p_request: parsed.data.requestId, p_status: parsed.data.status });
  if (error) return fromPostgrestError(error);
  revalidatePath("/oracao");
  return ok({ status: parsed.data.status });
}
