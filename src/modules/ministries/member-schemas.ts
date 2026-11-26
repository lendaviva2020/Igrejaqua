import { z } from "zod";
import { MINISTRY_PERMISSIONS } from "@/lib/permissions/capabilities";

export const MINISTRY_ROLE_LABEL = { coordinator: "Coordenação", member: "Integrante" } as const;
export const PERMISSION_LABEL: Record<(typeof MINISTRY_PERMISSIONS)[number], string> = {
  manage_ministry: "Gerenciar o ministério",
  manage_members: "Gerenciar integrantes",
  manage_schedule: "Montar escalas",
  publish_schedule: "Publicar escalas",
  manage_repertoire: "Gerenciar repertório",
  manage_rehearsals: "Gerenciar ensaios",
  manage_content: "Publicar comunicados e moderar orações",
  view_availability: "Ver disponibilidades",
};

const instruments = z
  .array(z.string().trim().min(1).max(40))
  .max(10, "No máximo 10 instrumentos")
  .transform((list) => [...new Set(list.map((i) => i.toLowerCase()))]);

export const AddMinistryMemberSchema = z
  .object({
    ministryId: z.string().uuid(),
    membershipId: z.string().uuid(),
    role: z.enum(["coordinator", "member"]).default("member"),
    instruments: instruments.default([]),
    voicePart: z.string().trim().max(40).optional(),
  })
  .strict();
export const UpdateMinistryMemberSchema = z
  .object({
    ministryId: z.string().uuid(),
    ministryMembershipId: z.string().uuid(),
    role: z.enum(["coordinator", "member"]),
    active: z.boolean(),
    instruments,
    voicePart: z.string().trim().max(40).nullable(),
  })
  .strict();
export const RemoveMinistryMemberSchema = z.object({ ministryId: z.string().uuid(), ministryMembershipId: z.string().uuid() }).strict();
export const SetPermissionSchema = z
  .object({ ministryId: z.string().uuid(), ministryMembershipId: z.string().uuid(), permission: z.enum(MINISTRY_PERMISSIONS), granted: z.boolean() })
  .strict();

/** "violão, teclado ,Violão" → ["violão","teclado"] */
export function parseInstruments(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
