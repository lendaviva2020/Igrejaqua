/** O SDK tipa o nível como string aberta; só "aal2" tem significado aqui. */
export type AssuranceLevel = string;
export type MfaRole = "admin" | "leader" | "member";

/** Admin com fator TOTP cadastrado precisa estar em aal2 para operar. */
export function needsMfaChallenge(role: MfaRole, current: AssuranceLevel | null, next: AssuranceLevel | null): boolean {
  return role === "admin" && next === "aal2" && current !== "aal2";
}

/** Admin sem autenticador verificado (nível máximo possível = aal1) precisa cadastrar um antes de operar. */
export function needsMfaEnrollment(role: MfaRole, next: AssuranceLevel | null): boolean {
  return role === "admin" && next !== "aal2";
}

export type MfaGate = "challenge" | "enroll" | "none";

export function mfaGate(role: MfaRole, current: AssuranceLevel | null, next: AssuranceLevel | null): MfaGate {
  if (needsMfaChallenge(role, current, next)) return "challenge";
  if (needsMfaEnrollment(role, next)) return "enroll";
  return "none";
}
