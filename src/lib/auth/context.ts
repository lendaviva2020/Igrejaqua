import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MINISTRY_PERMISSIONS, type AuthContext } from "@/lib/permissions/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CHURCH_COOKIE = "iq_church";

const uuid = z.string().uuid();
const membershipRow = z.object({
  id: z.string().uuid(),
  church_id: z.string().uuid(),
  role: z.enum(["admin", "leader", "member"]),
  churches: z.object({ name: z.string(), slug: z.string() }),
});
const ministryRow = z.object({
  ministry_id: z.string().uuid(),
  ministry_permissions: z.array(z.object({ permission: z.enum(MINISTRY_PERMISSIONS) })),
});

export interface ChurchSummary {
  readonly churchId: string;
  readonly name: string;
  readonly slug: string;
  readonly role: AuthContext["role"];
}

/** Usuário autenticado validado no servidor Auth (nunca getSession). */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email ?? "" };
}

export async function listMyChurches(userId: string): Promise<readonly ChurchSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("church_memberships")
    .select("id, church_id, role, churches!inner(name, slug)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(`Falha ao listar igrejas: ${error.message}`);
  return z
    .array(membershipRow)
    .parse(data)
    .map((m) => ({ churchId: m.church_id, name: m.churches.name, slug: m.churches.slug, role: m.role }));
}

/**
 * Resolve o contexto de igreja (ARCHITECTURE §4). O cookie é só uma preferência:
 * o vínculo é revalidado no banco a cada requisição, e a RLS reavalia depois disso.
 */
export async function resolveChurchContext(): Promise<AuthContext & { churchName: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const preferred = uuid.safeParse(cookieStore.get(CHURCH_COOKIE)?.value);

  const churches = await listMyChurches(user.id);
  const chosen = (preferred.success ? churches.find((c) => c.churchId === preferred.data) : undefined) ?? (churches.length === 1 ? churches[0] : undefined);
  if (chosen === undefined) redirect("/selecionar-igreja");

  const { data: membership, error: mErr } = await supabase
    .from("church_memberships")
    .select("id")
    .eq("church_id", chosen.churchId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (mErr || !membership) redirect("/selecionar-igreja");
  const membershipId = uuid.parse((membership as { id: unknown }).id);

  const { data: ministryData, error: pErr } = await supabase
    .from("ministry_memberships")
    .select("ministry_id, ministry_permissions(permission)")
    .eq("church_id", chosen.churchId)
    .eq("membership_id", membershipId)
    .eq("active", true);
  if (pErr) throw new Error(`Falha ao carregar permissões: ${pErr.message}`);
  const ministryPermissions: Record<string, readonly (typeof MINISTRY_PERMISSIONS)[number][]> = {};
  for (const row of z.array(ministryRow).parse(ministryData)) {
    ministryPermissions[row.ministry_id] = row.ministry_permissions.map((p) => p.permission);
  }
  return { userId: user.id, churchId: chosen.churchId, membershipId, role: chosen.role, ministryPermissions, churchName: chosen.name };
}
