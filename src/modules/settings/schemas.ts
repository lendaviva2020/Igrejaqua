import { z } from "zod";

export const DSR_KINDS = ["access", "correction", "erasure", "portability", "revocation"] as const;
export const DSR_KIND_LABEL: Record<(typeof DSR_KINDS)[number], string> = {
  access: "Acesso aos meus dados",
  correction: "Correção de dados",
  erasure: "Eliminação de dados",
  portability: "Portabilidade",
  revocation: "Revogação de consentimento",
};
export const DSR_STATUS_LABEL = { open: "Aberto", in_progress: "Em andamento", done: "Concluído", rejected: "Recusado" } as const;

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome").max(160),
    displayName: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(32).regex(/^[0-9()+\-\s]*$/, "Use apenas números, espaços, +, - e parênteses").optional(),
  })
  .strict();

const timezone = z.string().trim().min(3).max(64).refine((tz) => {
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: tz }); return true; } catch { return false; }
}, "Fuso horário inválido");

export const UpdateChurchSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome").max(160),
    legalName: z.string().trim().max(200).optional(),
    documentNumber: z.string().trim().max(20).regex(/^[0-9./\-]*$/, "Use apenas números, ponto, barra e hífen").optional(),
    timezone,
  })
  .strict();

export const CreateDsrSchema = z.object({ kind: z.enum(DSR_KINDS), details: z.string().trim().max(2000).optional() }).strict();
export const ResolveDsrSchema = z.object({ requestId: z.string().uuid(), status: z.enum(["in_progress", "done", "rejected"]) }).strict();

/** Versão do termo de uso de IA exibido ao administrador; registrada em consent_records. */
export const AI_CONSENT_VERSION = "ia-v1";
export const SetChurchAiSchema = z.object({ enabled: z.boolean(), acknowledged: z.boolean() }).strict().refine((v) => !v.enabled || v.acknowledged, { message: "Confirme o aviso para ativar a IA", path: ["acknowledged"] });
