import "server-only";
import { z } from "zod";
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
