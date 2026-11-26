"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddSessionSchema, CreateEventSchema } from "./schemas";

export async function createEventAction(input: unknown): Promise<Result<{ eventId: string }>> {
  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "event.manage")) return fail("FORBIDDEN", "Você não pode criar eventos.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_church: ctx.churchId,
    p_title: parsed.data.title,
    p_kind: parsed.data.kind,
    p_starts_local: parsed.data.startsLocal,
    p_ends_local: parsed.data.endsLocal,
    p_location: parsed.data.location ?? null,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/agenda");
  return ok({ eventId: z.string().uuid().parse(data) });
}

export async function addSessionAction(input: unknown): Promise<Result<{ sessionId: string }>> {
  const parsed = AddSessionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  if (!can(ctx, "event.manage")) return fail("FORBIDDEN", "Você não pode editar eventos.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_event_session", {
    p_event: parsed.data.eventId,
    p_name: parsed.data.name,
    p_starts_local: parsed.data.startsLocal,
    p_ends_local: parsed.data.endsLocal,
    p_ministry: parsed.data.ministryId ?? null,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath(`/agenda/${parsed.data.eventId}`);
  return ok({ sessionId: z.string().uuid().parse(data) });
}
