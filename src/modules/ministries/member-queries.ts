import "server-only";
import { z } from "zod";
import { MINISTRY_PERMISSIONS, type MinistryPermission } from "@/lib/permissions/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Dir = z.object({ membership_id: z.string().uuid(), display_name: z.string(), status: z.enum(["invited", "active", "suspended", "left"]) });
const Mm = z.object({
  id: z.string().uuid(), membership_id: z.string().uuid(), role: z.enum(["coordinator", "member"]), active: z.boolean(),
  instruments: z.array(z.string()), voice_part: z.string().nullable(),
  ministry_permissions: z.array(z.object({ permission: z.enum(MINISTRY_PERMISSIONS) })),
});
const Min = z.object({ id: z.string().uuid(), name: z.string(), description: z.string().nullable() });

export interface MinistryMemberItem {
  readonly id: string; readonly membershipId: string; readonly name: string; readonly role: "coordinator" | "member"; readonly active: boolean;
  readonly instruments: readonly string[]; readonly voicePart: string | null; readonly permissions: readonly MinistryPermission[];
}
export interface MinistryDetail {
  readonly id: string; readonly name: string; readonly description: string | null;
  readonly members: readonly MinistryMemberItem[]; readonly candidates: readonly { readonly membershipId: string; readonly name: string }[];
}

/** Permissões por integrante só vêm para quem pode vê-las (RLS mp_select: admin/líder ou o próprio). */
export async function getMinistryDetail(churchId: string, ministryId: string): Promise<MinistryDetail | null> {
  const supabase = await createSupabaseServerClient();
  const [min, mms, dir] = await Promise.all([
    supabase.from("ministries").select("id, name, description").eq("church_id", churchId).eq("id", ministryId).is("archived_at", null).maybeSingle(),
    supabase.from("ministry_memberships").select("id, membership_id, role, active, instruments, voice_part, ministry_permissions(permission)").eq("church_id", churchId).eq("ministry_id", ministryId),
    supabase.rpc("church_directory", { p_church: churchId }),
  ]);
  if (min.error) throw new Error(`Falha ao carregar ministério: ${min.error.message}`);
  if (min.data === null) return null;
  if (mms.error) throw new Error(`Falha ao listar integrantes: ${mms.error.message}`);
  if (dir.error) throw new Error(`Falha ao listar pessoas: ${dir.error.message}`);
  const ministry = Min.parse(min.data);
  const people = new Map(z.array(Dir).parse(dir.data).map((p) => [p.membership_id, p]));
  const rows = z.array(Mm).parse(mms.data);
  const inMinistry = new Set(rows.map((r) => r.membership_id));
  const members = rows
    .map((r): MinistryMemberItem => ({ id: r.id, membershipId: r.membership_id, name: people.get(r.membership_id)?.display_name ?? "Pessoa", role: r.role, active: r.active, instruments: r.instruments, voicePart: r.voice_part, permissions: r.ministry_permissions.map((p) => p.permission) }))
    .sort((a, b) => Number(b.role === "coordinator") - Number(a.role === "coordinator") || a.name.localeCompare(b.name, "pt-BR"));
  const candidates = [...people.values()].filter((p) => p.status === "active" && !inMinistry.has(p.membership_id)).map((p) => ({ membershipId: p.membership_id, name: p.display_name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { ...ministry, members, candidates };
}
