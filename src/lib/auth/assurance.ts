import "server-only";
import type { AssuranceLevel } from "@/lib/auth/mfa-policy";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface VerifiedAssurance {
  readonly currentLevel: AssuranceLevel | null;
  readonly nextLevel: AssuranceLevel | null;
}

/**
 * Nível de autenticação (aal1/aal2) a partir de dados VERIFICADOS, nunca de getSession().
 * `mfa.getAuthenticatorAssuranceLevel()` sem argumento lê a sessão do cookie (getSession) e usa
 * `session.user.factors` sem validar — por isso o SDK emite o aviso de insegurança no servidor.
 * Aqui: `getClaims()` confere a assinatura do JWT (ou consulta o Auth) e dá o `aal` atual;
 * `getUser()` consulta o servidor Auth e dá os fatores realmente verificados.
 */
export async function getVerifiedAssurance(supabase: ServerClient): Promise<VerifiedAssurance> {
  const [{ data: claimsData, error: claimsError }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);
  if (claimsError || userError || !claimsData || !userData.user) return { currentLevel: null, nextLevel: null };
  const currentLevel = claimsData.claims.aal ?? null;
  const hasVerifiedFactor = (userData.user.factors ?? []).some((f) => f.status === "verified");
  return { currentLevel, nextLevel: hasVerifiedFactor ? "aal2" : currentLevel };
}
