import { NextResponse, type NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url.server";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { exchangeAuthorizationCode, mercadoPagoAppConfig, MercadoPagoOAuthError } from "@/lib/payments/mercadopago-oauth";
import { decodeOAuthCookie, OAUTH_COOKIE, OAUTH_COOKIE_PATH, sameState } from "@/lib/payments/mercadopago-oauth-cookie";
import { saveMercadoPagoAccount } from "@/modules/contributions/mp-accounts-store";

export const dynamic = "force-dynamic";

/**
 * Retorno do Mercado Pago depois que a igreja autoriza. Confere state (CSRF), PKCE, que é a MESMA
 * pessoa e a MESMA igreja que iniciaram e que ela continua na administração; troca o código pelas
 * credenciais da conta da igreja e guarda cifradas. Nunca registra o código nem os tokens.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = await getAppBaseUrl();
  const cookie = decodeOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const finish = (status: string): NextResponse => {
    const res = NextResponse.redirect(`${base}/configuracoes?mp=${status}#contribuicoes`, 303);
    res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, path: OAUTH_COOKIE_PATH, maxAge: 0 });
    res.headers.set("cache-control", "no-store");
    return res;
  };

  const url = request.nextUrl;
  if (url.searchParams.get("error") !== null) return finish("cancelado");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (cookie === null || code === null || state === null || !/^[A-Za-z0-9_.-]{6,200}$/.test(code) || !sameState(state, cookie.state)) return finish("invalido");

  const ctx = await resolveChurchContext();
  if (ctx.userId !== cookie.userId || ctx.churchId !== cookie.churchId || !can(ctx, "finance.manage")) return finish("invalido");
  const app = mercadoPagoAppConfig();
  if (app === null) return finish("indisponivel");

  try {
    const tokens = await exchangeAuthorizationCode(app, { code, redirectUri: `${base}/api/payments/mercadopago/callback`, codeVerifier: cookie.verifier });
    await saveMercadoPagoAccount(ctx.churchId, tokens, ctx.userId);
  } catch (cause) {
    console.error("mp_oauth_failed", cause instanceof MercadoPagoOAuthError ? cause.message : cause instanceof Error ? cause.name : "erro interno");
    return finish("erro");
  }
  return finish("conectado");
}
