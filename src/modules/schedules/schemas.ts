import { z } from "zod";

export const AddLineupSchema = z
  .object({
    sessionId: z.string().uuid(),
    ministryId: z.string().uuid(),
    ministryMembershipId: z.string().uuid(),
    function: z.string().trim().min(1, "Informe a função").max(60),
    overrideReason: z.string().trim().min(5, "Descreva o motivo").max(500).optional(),
  })
  .strict();
export type AddLineupInput = z.input<typeof AddLineupSchema>;

export const LineupIdSchema = z.object({ lineupId: z.string().uuid() }).strict();
export const PublishSchema = z.object({ sessionId: z.string().uuid(), ministryId: z.string().uuid() }).strict();
export const RespondSchema = z.object({ lineupId: z.string().uuid(), response: z.enum(["confirmed", "declined"]) }).strict();

export const LINEUP_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", published: "Aguardando confirmação", confirmed: "Confirmado", declined: "Recusou", replaced: "Substituído", cancelled: "Cancelado",
};
