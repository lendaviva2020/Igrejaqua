export type ErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT"
  | "RULE_VIOLATION" | "RATE_LIMITED" | "AI_UNAVAILABLE" | "UNAVAILABLE" | "INTERNAL";

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly fields?: Readonly<Record<string, readonly string[]>>;
}
export type Result<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: AppError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string, fields?: Readonly<Record<string, readonly string[]>>): Result<never> =>
  fields === undefined ? { ok: false, error: { code, message } } : { ok: false, error: { code, message, fields } };

/** Traduz erros do Postgres/PostgREST para mensagens seguras (sem vazar SQL). */
export function fromPostgrestError(error: { code?: string; message: string }): Result<never> {
  switch (error.code) {
    case "42501": return fail("FORBIDDEN", "Você não tem permissão para esta operação.");
    case "23505": return fail("CONFLICT", "Já existe um registro com estes dados.");
    case "23503": return fail("RULE_VIOLATION", "Registro relacionado inexistente ou de outra igreja.");
    case "23514": case "23P01": return fail("RULE_VIOLATION", sanitizeRuleMessage(error.message));
    case "P0002": return fail("NOT_FOUND", "Registro não encontrado.");
    case "28000": return fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
    default: return fail("INTERNAL", "Não foi possível concluir a operação. Tente novamente.");
  }
}

/** Mensagens das nossas triggers são em pt-BR e seguras; qualquer outra vira texto genérico. */
function sanitizeRuleMessage(message: string): string {
  return /^[\p{L}\p{N} .,:;()\-_/'"%]+$/u.test(message) && message.length < 160 ? message : "A operação viola uma regra do sistema.";
}

export function zodFieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
