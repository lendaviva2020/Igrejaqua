import { z } from "zod";

export const CreatePrayerSchema = z
  .object({ body: z.string().trim().min(3, "Escreva o pedido").max(2000, "Máximo de 2000 caracteres"), anonymous: z.boolean(), ministryId: z.string().uuid().optional() })
  .strict();
export type CreatePrayerInput = z.input<typeof CreatePrayerSchema>;
export const PrayActionSchema = z.object({ requestId: z.string().uuid(), praying: z.boolean() }).strict();
export const ModeratePrayerSchema = z.object({ requestId: z.string().uuid(), status: z.enum(["answered", "archived", "removed", "open"]) }).strict();
