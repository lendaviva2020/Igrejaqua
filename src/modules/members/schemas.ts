import { z } from "zod";

export const ROLES = ["member", "leader", "admin"] as const;
export const ROLE_LABEL: Record<(typeof ROLES)[number], string> = { member: "Membro", leader: "Liderança", admin: "Administração" };

export const InviteSchema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido").max(254), role: z.enum(ROLES) }).strict();
export type InviteInput = z.input<typeof InviteSchema>;
export const ChangeRoleSchema = z.object({ membershipId: z.string().uuid(), role: z.enum(ROLES) }).strict();
export const SetStatusSchema = z.object({ membershipId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).strict();
export const RevokeInviteSchema = z.object({ invitationId: z.string().uuid() }).strict();
