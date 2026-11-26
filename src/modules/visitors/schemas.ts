import { z } from "zod";

export const VISITOR_STATUSES = ["novo", "em_acompanhamento", "integrado", "arquivado"] as const;
export type VisitorStatus = (typeof VISITOR_STATUSES)[number];
export const VISITOR_STATUS_LABEL: Record<VisitorStatus, string> = { novo: "Novo", em_acompanhamento: "Em acompanhamento", integrado: "Integrado", arquivado: "Arquivado" };
export const FOLLOWUP_KINDS = ["ligacao", "visita", "mensagem", "outro"] as const;
export type FollowupKind = (typeof FOLLOWUP_KINDS)[number];
export const FOLLOWUP_KIND_LABEL: Record<FollowupKind, string> = { ligacao: "Ligação", visita: "Visita", mensagem: "Mensagem", outro: "Outro" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export const CreateVisitorSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome").max(120),
  phone: z.string().trim().min(8, "Telefone muito curto").max(30).optional(),
  email: z.string().trim().email("E-mail inválido").max(200).optional(),
  source: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  firstVisitOn: isoDate.optional(),
  /** Obrigatório quando houver telefone ou e-mail (LGPD): a pessoa autorizou o contato. */
  contactConsent: z.boolean(),
}).strict().refine((v) => (v.phone === undefined && v.email === undefined) || v.contactConsent, { message: "Registre a autorização da pessoa para guardar telefone ou e-mail.", path: ["contactConsent"] });

export const SetVisitorStatusSchema = z.object({ visitorId: z.string().uuid(), status: z.enum(VISITOR_STATUSES) }).strict();
export const VisitorIdSchema = z.object({ visitorId: z.string().uuid() }).strict();
export const AddFollowupSchema = z.object({ visitorId: z.string().uuid(), kind: z.enum(FOLLOWUP_KINDS), note: z.string().trim().min(1, "Descreva o contato").max(1000), doneOn: isoDate.optional() }).strict();
