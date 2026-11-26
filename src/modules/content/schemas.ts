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
  })
  .strict();
export type CreateContentInput = z.input<typeof CreateContentSchema>;

export const SetContentStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["published", "archived", "draft"]) }).strict();
