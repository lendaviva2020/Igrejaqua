import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EventRow = z.object({ id: z.string().uuid(), title: z.string(), kind: z.string(), starts_at: z.string(), ends_at: z.string(), location: z.string().nullable() });
export type UpcomingEvent = z.infer<typeof EventRow>;

export async function listUpcomingEvents(churchId: string, limit = 5): Promise<readonly UpcomingEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, kind, starts_at, ends_at, location")
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw new Error(`Falha ao listar eventos: ${error.message}`);
  return z.array(EventRow).parse(data);
}

const MyLineupRow = z.object({
  id: z.string().uuid(), function: z.string(), status: z.string(),
  event_sessions: z.object({ name: z.string(), starts_at: z.string(), events: z.object({ title: z.string() }) }),
});
export type MyLineup = z.infer<typeof MyLineupRow>;

export async function listMyUpcomingLineup(churchId: string, membershipId: string): Promise<readonly MyLineup[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_lineup")
    .select("id, function, status, ministry_memberships!inner(membership_id), event_sessions!inner(name, starts_at, events!inner(title))")
    .eq("church_id", churchId)
    .eq("ministry_memberships.membership_id", membershipId)
    .in("status", ["published", "confirmed"])
    .gte("event_sessions.starts_at", new Date().toISOString())
    .order("starts_at", { referencedTable: "event_sessions" })
    .limit(10);
  if (error) throw new Error(`Falha ao listar escalas: ${error.message}`);
  return z.array(MyLineupRow).parse(data);
}
