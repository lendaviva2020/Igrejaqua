import "server-only";
import { z } from "zod";
import { CHANNEL_DEFAULT, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, type ChannelPreferences, type NotificationCategory, type NotificationChannel } from "./preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({ id: z.string().uuid(), category: z.string(), title: z.string(), body: z.string().nullable(), link_path: z.string().nullable(), read_at: z.string().nullable(), created_at: z.string() });
export type NotificationItem = z.infer<typeof Row>;

export async function listNotifications(churchId: string): Promise<readonly NotificationItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("notifications").select("id, category, title, body, link_path, read_at, created_at").eq("church_id", churchId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`Falha ao listar notificações: ${error.message}`);
  return z.array(Row).parse(data);
}

export async function countUnreadNotifications(churchId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("church_id", churchId).is("read_at", null);
  if (error) throw new Error(`Falha ao contar notificações: ${error.message}`);
  return count ?? 0;
}

/** Sem registro vale o padrão do canal (sistema/celular ligados; e-mail só com opt-in). */
export async function getChannelPreferences(churchId: string): Promise<ChannelPreferences> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("notification_preferences").select("category, channel, enabled").eq("church_id", churchId);
  if (error) throw new Error(`Falha ao carregar preferências: ${error.message}`);
  const result: Record<NotificationChannel, Record<NotificationCategory, boolean>> = {
    in_app: { escala: CHANNEL_DEFAULT.in_app, comunicado: CHANNEL_DEFAULT.in_app, devocional: CHANNEL_DEFAULT.in_app, contribuicao: CHANNEL_DEFAULT.in_app, membros: CHANNEL_DEFAULT.in_app },
    email: { escala: CHANNEL_DEFAULT.email, comunicado: CHANNEL_DEFAULT.email, devocional: CHANNEL_DEFAULT.email, contribuicao: CHANNEL_DEFAULT.email, membros: CHANNEL_DEFAULT.email },
    push: { escala: CHANNEL_DEFAULT.push, comunicado: CHANNEL_DEFAULT.push, devocional: CHANNEL_DEFAULT.push, contribuicao: CHANNEL_DEFAULT.push, membros: CHANNEL_DEFAULT.push },
  };
  for (const row of data as { category: string; channel: string; enabled: boolean }[]) {
    const cat = NOTIFICATION_CATEGORIES.find((c) => c === row.category);
    const channel = NOTIFICATION_CHANNELS.find((c) => c === row.channel);
    if (cat !== undefined && channel !== undefined) result[channel][cat] = row.enabled;
  }
  return result;
}
