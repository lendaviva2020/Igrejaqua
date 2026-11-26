import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({ session_id: z.string().uuid(), status: z.enum(["going", "maybe", "not_going"]), membership_id: z.string().uuid() });
export interface RsvpSummary { readonly mine: Readonly<Record<string, "going" | "maybe" | "not_going">>; readonly goingCount: Readonly<Record<string, number>> }

/** RLS: membro comum só enxerga o próprio RSVP; quem gerencia escala enxerga todos (contagem). */
export async function getRsvpSummary(churchId: string, membershipId: string, sessionIds: readonly string[]): Promise<RsvpSummary> {
  if (sessionIds.length === 0) return { mine: {}, goingCount: {} };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("event_rsvps").select("session_id, status, membership_id").eq("church_id", churchId).in("session_id", [...sessionIds]);
  if (error) throw new Error(`Falha ao carregar RSVP: ${error.message}`);
  const mine: Record<string, "going" | "maybe" | "not_going"> = {};
  const goingCount: Record<string, number> = {};
  for (const r of z.array(Row).parse(data)) {
    if (r.membership_id === membershipId) mine[r.session_id] = r.status;
    if (r.status === "going") goingCount[r.session_id] = (goingCount[r.session_id] ?? 0) + 1;
  }
  return { mine, goingCount };
}
