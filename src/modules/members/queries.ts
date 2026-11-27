import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Dir = z.object({ membership_id: z.string().uuid(), display_name: z.string(), role: z.enum(["admin", "leader", "member"]), status: z.enum(["invited", "active", "suspended", "left", "pending"]) });
const Inv = z.object({ id: z.string().uuid(), email: z.string(), role: z.enum(["admin", "leader", "member"]), expires_at: z.string(), accepted_at: z.string().nullable() });
export interface MemberItem { readonly membershipId: string; readonly name: string; readonly role: "admin" | "leader" | "member"; readonly status: "invited" | "active" | "suspended" | "left" | "pending" }
export type InvitationItem = z.infer<typeof Inv>;

export async function listMembers(churchId: string): Promise<readonly MemberItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("church_directory", { p_church: churchId });
  if (error) throw new Error(`Falha ao listar membros: ${error.message}`);
  return z.array(Dir).parse(data).map((d) => ({ membershipId: d.membership_id, name: d.display_name, role: d.role, status: d.status })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Link geral ativo da igreja (RLS: só administração). */
export async function getActiveJoinLink(churchId: string): Promise<{ token: string; createdAt: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_join_links").select("token, created_at").eq("church_id", churchId).is("revoked_at", null).maybeSingle();
  if (error) throw new Error(`Falha ao carregar o link da igreja: ${error.message}`);
  if (data === null) return null;
  const row = z.object({ token: z.string(), created_at: z.string() }).parse(data);
  return { token: row.token, createdAt: row.created_at };
}

/** RLS: só administração enxerga convites. */
export async function listPendingInvitations(churchId: string): Promise<readonly InvitationItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_invitations").select("id, email, role, expires_at, accepted_at").eq("church_id", churchId).is("accepted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Falha ao listar convites: ${error.message}`);
  return z.array(Inv).parse(data);
}
