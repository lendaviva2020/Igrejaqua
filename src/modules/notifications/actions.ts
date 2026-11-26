"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { fail, fromPostgrestError, ok, type Result } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RemovePushSubscriptionSchema, SavePushSubscriptionSchema, SetPreferenceSchema } from "./preferences";

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

/** Preferência por categoria e canal (sistema, e-mail, celular). Upsert na chave (igreja, usuário, categoria, canal); RLS restringe ao titular. */
export async function setNotificationPreferenceAction(input: unknown): Promise<Result<{ enabled: boolean }>> {
  const parsed = SetPreferenceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Preferência inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    { church_id: ctx.churchId, user_id: ctx.userId, category: parsed.data.category, channel: parsed.data.channel, enabled: parsed.data.enabled },
    { onConflict: "church_id,user_id,category,channel" },
  );
  if (error) return fromPostgrestError(error);
  revalidatePath("/notificacoes");
  return ok({ enabled: parsed.data.enabled });
}

/** Registra o navegador atual para receber push. Validação final no banco (função SECURITY DEFINER, usuário = auth.uid()). */
export async function savePushSubscriptionAction(input: unknown): Promise<Result<{ subscribed: true }>> {
  const parsed = SavePushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Inscrição de notificações inválida.");
  await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.p256dh, p_auth: parsed.data.auth });
  if (error) return fromPostgrestError(error);
  return ok({ subscribed: true });
}

export async function removePushSubscriptionAction(input: unknown): Promise<Result<{ subscribed: false }>> {
  const parsed = RemovePushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Inscrição de notificações inválida.");
  await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_push_subscription", { p_endpoint: parsed.data.endpoint });
  if (error) return fromPostgrestError(error);
  return ok({ subscribed: false });
}
