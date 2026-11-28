import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url.server";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { authorizationUrl, createOAuthState, createPkcePair, mercadoPagoAppConfig } from "@/lib/payments/mercadopago-oauth";
import { encodeOAuthCookie, OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH } from "@/lib/payments/mercadopago-oauth-cookie";
import { loadTokenKey } from "@/lib/payments/token-crypto";

export const dynamic = "force-dynamic";

/**
 * Inicia a conexão do Mercado Pago DA IGREJA atual. Só a administração (que já entrou com verificação
 * em duas etapas). Leva ao Mercado Pago, onde a igreja entra na própria conta e autoriza o IGREJAQUA.
 */
export async function GET(): Promise<NextResponse> {
  const ctx = await resolveChurchContext();
  const base = await getAppBaseUrl();
  const back = (status: string): NextResponse => NextResponse.redirect(`${base}/configuracoes?mp=${status}#contribuicoes`, 303);
  if (!can(ctx, "finance.manage")) return back("sem-permissao");
  const app = mercadoPagoAppConfig();
  try { loadTokenKey(); } catch { return back("indisponivel"); }
  if (app === null) return back("indisponivel");

  const state = createOAuthState();
  const pkce = createPkcePair();
  const redirectUri = `${base}/api/payments/mercadopago/callback`;
  const res = NextResponse.redirect(authorizationUrl(app, { redirectUri, state, codeChallenge: pkce.challenge }), 303);
  res.cookies.set(OAUTH_COOKIE, encodeOAuthCookie({ state, verifier: pkce.verifier, churchId: ctx.churchId, userId: ctx.userId }), {
    httpOnly: true, secure: base.startsWith("https://"), sameSite: "lax", path: OAUTH_COOKIE_PATH, maxAge: OAUTH_COOKIE_MAX_AGE,
  });
  res.headers.set("cache-control", "no-store");
  return res;
}
