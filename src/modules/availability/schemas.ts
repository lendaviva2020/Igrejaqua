import { z } from "zod";

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

export const DeclareUnavailabilitySchema = z
  .object({
    from: DateOnly,
    to: DateOnly,
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.to >= v.from, { path: ["to"], message: "A data final deve ser igual ou posterior à inicial" });
export type DeclareUnavailabilityInput = z.input<typeof DeclareUnavailabilitySchema>;
export const RemoveUnavailabilitySchema = z.object({ id: z.string().uuid() }).strict();
export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
