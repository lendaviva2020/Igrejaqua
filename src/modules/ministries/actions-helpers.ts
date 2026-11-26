import { z } from "zod";

export const CreateMinistrySchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome").max(120),
    description: z.string().trim().max(1000).optional(),
  })
  .strict();

/** "Louvor & Adoração" → "louvor-adoracao" (sem acentos, apenas [a-z0-9-]). */
export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base.length >= 2 ? base : "ministerio";
}

