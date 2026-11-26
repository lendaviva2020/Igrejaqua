import { z } from "zod";

/** Valor de <input type="datetime-local">: horário LOCAL da igreja, sem fuso. */
export const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data/hora inválida");
export const EVENT_KINDS = ["service", "rehearsal", "special", "meeting"] as const;
export const EVENT_KIND_LABEL: Record<(typeof EVENT_KINDS)[number], string> = { service: "Culto", rehearsal: "Ensaio", special: "Evento especial", meeting: "Reunião" };

export const CreateEventSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título").max(200),
    kind: z.enum(EVENT_KINDS),
    startsLocal: LocalDateTime,
    endsLocal: LocalDateTime,
    location: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((v) => v.endsLocal > v.startsLocal, { path: ["endsLocal"], message: "O fim deve ser depois do início" });
export type CreateEventInput = z.input<typeof CreateEventSchema>;

export const AddSessionSchema = z
  .object({
    eventId: z.string().uuid(),
    name: z.string().trim().min(1, "Informe o nome").max(120),
    startsLocal: LocalDateTime,
    endsLocal: LocalDateTime,
    ministryId: z.string().uuid().optional(),
  })
  .strict()
  .refine((v) => v.endsLocal > v.startsLocal, { path: ["endsLocal"], message: "O fim deve ser depois do início" });
export type AddSessionInput = z.input<typeof AddSessionSchema>;
