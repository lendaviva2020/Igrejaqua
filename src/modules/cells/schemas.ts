import { z } from "zod";

export const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM");

export const CreateCellSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da célula").max(120),
  leaderMembershipId: z.string().uuid("Escolha o líder"),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  meetingTime: time.optional(),
  location: z.string().trim().max(200).optional(),
}).strict();

export const CellMemberSchema = z.object({ cellId: z.string().uuid(), membershipId: z.string().uuid("Escolha o membro") }).strict();
export const CellIdSchema = z.object({ cellId: z.string().uuid() }).strict();
export const RecordMeetingSchema = z.object({
  cellId: z.string().uuid(),
  heldOn: isoDate,
  topic: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  attendees: z.array(z.string().uuid()).max(200).default([]),
}).strict();
