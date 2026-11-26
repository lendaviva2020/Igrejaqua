import { z } from "zod";

export const FAMILY_RELATIONS = ["responsavel", "conjuge", "filho", "outro"] as const;
export type FamilyRelation = (typeof FAMILY_RELATIONS)[number];
export const FAMILY_RELATION_LABEL: Record<FamilyRelation, string> = { responsavel: "Responsável", conjuge: "Cônjuge", filho: "Filho(a)", outro: "Outro" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD").refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data inválida");

export const CreateFamilySchema = z.object({ name: z.string().trim().min(1, "Informe o nome da família").max(120) }).strict();
export const FamilyIdSchema = z.object({ familyId: z.string().uuid() }).strict();
export const FamilyMemberIdSchema = z.object({ id: z.string().uuid() }).strict();

/** Pessoa com conta (membershipId) OU dependente sem conta (fullName). */
export const AddFamilyMemberSchema = z.object({
  familyId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
  relation: z.enum(FAMILY_RELATIONS),
  birthDate: isoDate.optional(),
}).strict().refine((v) => (v.membershipId === undefined) !== (v.fullName === undefined), { message: "Escolha um membro da igreja ou informe o nome do dependente.", path: ["fullName"] });
