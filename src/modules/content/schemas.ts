import { z } from "zod";

export const CONTENT_KINDS = ["announcement", "devotional"] as const;
export const CONTENT_KIND_LABEL: Record<(typeof CONTENT_KINDS)[number], string> = { announcement: "Comunicado", devotional: "Devocional" };

export const CreateContentSchema = z
  .object({
    kind: z.enum(CONTENT_KINDS),
    title: z.string().trim().min(2, "Informe o título").max(200),
    body: z.string().trim().min(1, "Escreva o conteúdo").max(20000),
    scriptureRef: z.string().trim().max(120).optional(),
    /** Ausente = toda a igreja (só administração). Presente = ministério. */
    ministryId: z.string().uuid().optional(),
    publish: z.boolean(),
    /** Instante UTC (ISO) da publicação agendada; incompatível com `publish: true`. */
    publishAt: z.string().datetime({ offset: true, message: "Data de publicação inválida" }).optional(),
  })
  .strict()
  .refine((v) => !(v.publish && v.publishAt !== undefined), { path: ["publishAt"], message: "Escolha publicar agora ou agendar" });
export type CreateContentInput = z.input<typeof CreateContentSchema>;

/** Agendamento válido: ao menos 1 minuto à frente e no máximo 1 ano. */
export function isValidSchedule(publishAt: Date, now: Date): boolean {
  const delta = publishAt.getTime() - now.getTime();
  return delta >= 60_000 && delta <= 366 * 24 * 3_600_000;
}

export const SetContentStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["published", "archived", "draft"]) }).strict();
