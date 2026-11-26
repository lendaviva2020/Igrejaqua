import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FAMILY_RELATIONS } from "./schemas";

const Row = z.object({
  id: z.string().uuid(),
  name: z.string(),
  family_members: z.array(z.object({ id: z.string().uuid(), membership_id: z.string().uuid().nullable(), full_name: z.string().nullable(), relation: z.enum(FAMILY_RELATIONS), birth_date: z.string().nullable() })),
});

export interface FamilyMemberItem { readonly id: string; readonly membershipId: string | null; readonly fullName: string | null; readonly relation: (typeof FAMILY_RELATIONS)[number]; readonly birthDate: string | null }
export interface FamilyItem { readonly id: string; readonly name: string; readonly members: readonly FamilyMemberItem[] }

/** A RLS decide o que cada papel vê (administração/liderança: todas; membro: apenas a própria família). */
export async function listFamilies(churchId: string): Promise<readonly FamilyItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("families").select("id, name, family_members(id, membership_id, full_name, relation, birth_date)").eq("church_id", churchId).order("name");
  if (error) throw new Error(`Falha ao listar famílias: ${error.message}`);
  return z.array(Row).parse(data).map((f) => ({ id: f.id, name: f.name, members: f.family_members.map((m) => ({ id: m.id, membershipId: m.membership_id, fullName: m.full_name, relation: m.relation, birthDate: m.birth_date })) }));
}
