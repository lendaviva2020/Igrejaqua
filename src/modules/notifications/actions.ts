"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { fail, fromPostgrestError, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const IdSchema = z.object({ id: z.string().uuid() }).strict();

export async function markNotificationReadAction(input: unknown): Promise<Result<{ read: true }>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Notificação inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("church_id", ctx.churchId).eq("id", parsed.data.id).is("read_at", null);
  if (error) return fromPostgrestError(error);
  revalidatePath("/notificacoes");
  revalidatePath("/dashboard");
  return ok({ read: true });
}

export async function markAllNotificationsReadAction(): Promise<Result<{ read: true }>> {
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("church_id", ctx.churchId).is("read_at", null);
  if (error) return fromPostgrestError(error);
  revalidatePath("/notificacoes");
  revalidatePath("/dashboard");
  return ok({ read: true });
}
