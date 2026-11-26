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

const SessionRow = z.object({ id: z.string().uuid(), name: z.string(), starts_at: z.string(), ends_at: z.string(), ministry_id: z.string().uuid().nullable(), position: z.number() });
const EventDetailRow = z.object({
  id: z.string().uuid(), title: z.string(), kind: z.string(), status: z.string(), starts_at: z.string(), ends_at: z.string(), location: z.string().nullable(), description: z.string().nullable(),
  event_sessions: z.array(SessionRow),
});
export type EventDetail = z.infer<typeof EventDetailRow>;

export async function getEventDetail(churchId: string, eventId: string): Promise<EventDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, kind, status, starts_at, ends_at, location, description, event_sessions(id, name, starts_at, ends_at, ministry_id, position)")
    .eq("church_id", churchId)
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar evento: ${error.message}`);
  if (data === null) return null;
  const parsed = EventDetailRow.parse(data);
  return { ...parsed, event_sessions: [...parsed.event_sessions].sort((a, b) => a.position - b.position || a.starts_at.localeCompare(b.starts_at)) };
}

export async function getChurchTimezone(churchId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("churches").select("timezone").eq("id", churchId).single();
  if (error) throw new Error(`Falha ao carregar fuso: ${error.message}`);
  return z.object({ timezone: z.string() }).parse(data).timezone;
}
