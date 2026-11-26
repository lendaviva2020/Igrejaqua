import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LineupRow = z.object({
  id: z.string().uuid(), session_id: z.string().uuid(), ministry_id: z.string().uuid(), function: z.string(), status: z.string(), note: z.string().nullable(),
  ministry_memberships: z.object({ membership_id: z.string().uuid() }),
});
const DirectoryRow = z.object({ membership_id: z.string().uuid(), display_name: z.string() });
const MemberRow = z.object({ id: z.string().uuid(), ministry_id: z.string().uuid(), membership_id: z.string().uuid(), instruments: z.array(z.string()) });

export interface LineupEntry { readonly id: string; readonly sessionId: string; readonly ministryId: string; readonly function: string; readonly status: string; readonly personName: string; readonly mine: boolean }
export interface MinistryPerson { readonly ministryMembershipId: string; readonly ministryId: string; readonly name: string; readonly instruments: readonly string[] }

async function directoryNames(churchId: string): Promise<Map<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("church_directory", { p_church: churchId });
  if (error) throw new Error(`Falha ao carregar diretório: ${error.message}`);
  return new Map(z.array(DirectoryRow).parse(data).map((d) => [d.membership_id, d.display_name] as const));
}

export async function listLineupForSessions(churchId: string, membershipId: string, sessionIds: readonly string[]): Promise<readonly LineupEntry[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_lineup")
    .select("id, session_id, ministry_id, function, status, note, ministry_memberships!inner(membership_id)")
    .eq("church_id", churchId)
    .in("session_id", [...sessionIds])
    .neq("status", "cancelled");
  if (error) throw new Error(`Falha ao listar escala: ${error.message}`);
  const names = await directoryNames(churchId);
  return z.array(LineupRow).parse(data).map((l) => ({
    id: l.id, sessionId: l.session_id, ministryId: l.ministry_id, function: l.function, status: l.status,
    personName: names.get(l.ministry_memberships.membership_id) ?? "Membro",
    mine: l.ministry_memberships.membership_id === membershipId,
  }));
}

export async function listPeopleForMinistries(churchId: string, ministryIds: readonly string[]): Promise<readonly MinistryPerson[]> {
  if (ministryIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ministry_memberships")
    .select("id, ministry_id, membership_id, instruments")
    .eq("church_id", churchId)
    .in("ministry_id", [...ministryIds])
    .eq("active", true);
  if (error) throw new Error(`Falha ao listar equipe: ${error.message}`);
  const names = await directoryNames(churchId);
  return z.array(MemberRow).parse(data).map((m) => ({ ministryMembershipId: m.id, ministryId: m.ministry_id, name: names.get(m.membership_id) ?? "Membro", instruments: m.instruments }));
}
