/** Aceita o link inteiro (…/entrar/<código> ou …?convite=<código>) ou só o código. */
export function extractJoinCode(raw: string): string {
  const value = raw.trim();
  const entrar = /\/entrar\/([A-Za-z0-9_-]+)/.exec(value);
  if (entrar?.[1]) return entrar[1];
  const convite = /[?&]convite=([A-Za-z0-9_-]+)/.exec(value);
  if (convite?.[1]) return convite[1];
  return value;
}
