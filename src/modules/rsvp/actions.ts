"use server";

import { revalidatePath } from "next/cache";
import { resolveChurchContext } from "@/lib/auth/context";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RsvpSchema } from "./schemas";

export async function setRsvpAction(input: unknown): Promise<Result<{ status: string }>> {
  const parsed = RsvpSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("event_rsvps").upsert(
    { church_id: ctx.churchId, session_id: parsed.data.sessionId, membership_id: ctx.membershipId, status: parsed.data.status, guests: parsed.data.guests, responded_at: new Date().toISOString() },
    { onConflict: "church_id,session_id,membership_id" },
  );
  if (error) return fromPostgrestError(error);
  revalidatePath("/agenda", "layout");
  return ok({ status: parsed.data.status });
}
