import { z } from "zod";

export const RSVP_STATUSES = ["going", "maybe", "not_going"] as const;
export const RSVP_LABEL: Record<(typeof RSVP_STATUSES)[number], string> = { going: "Vou", maybe: "Talvez", not_going: "Não vou" };
export const RsvpSchema = z.object({ sessionId: z.string().uuid(), status: z.enum(RSVP_STATUSES), guests: z.number().int().min(0).max(20).default(0) }).strict();
