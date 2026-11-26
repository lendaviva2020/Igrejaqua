/** O SDK tipa o nível como string aberta; só "aal2" tem significado aqui. */
export type AssuranceLevel = string;
export type MfaRole = "admin" | "leader" | "member";

/**
 * Admin com fator TOTP cadastrado precisa estar em aal2 para operar. Quem ainda não cadastrou fator não é bloqueado
 * (evita trancar o primeiro administrador); a tela de Configurações mostra o aviso até o cadastro.
 */
export function needsMfaChallenge(role: MfaRole, current: AssuranceLevel | null, next: AssuranceLevel | null): boolean {
  return role === "admin" && next === "aal2" && current !== "aal2";
}

export function shouldPromptEnrollment(role: MfaRole, next: AssuranceLevel | null): boolean {
  return role === "admin" && next !== "aal2";
}
