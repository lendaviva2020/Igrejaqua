import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Conexão da conta Mercado Pago DE CADA IGREJA pelo OAuth oficial (modelo de plataforma do Mercado Pago).
 * O IGREJAQUA tem um "aplicativo" no Mercado Pago (client id/secret); cada igreja autoriza esse
 * aplicativo na própria conta e o dinheiro das contribuições cai direto nela.
 *
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/security/oauth
 */

const AUTH_URL = "https://auth.mercadopago.com.br/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const TIMEOUT_MS = 15_000;

export interface MercadoPagoAppConfig { readonly clientId: string; readonly clientSecret: string }

const AppSchema = z.object({ clientId: z.string().regex(/^\d{5,25}$/), clientSecret: z.string().min(16) });

/** null = conexão com Mercado Pago indisponível (o responsável técnico ainda não criou o aplicativo). */
export function mercadoPagoAppConfig(env: Readonly<Record<string, string | undefined>> = process.env): MercadoPagoAppConfig | null {
  const parsed = AppSchema.safeParse({ clientId: env["MERCADOPAGO_CLIENT_ID"]?.trim(), clientSecret: env["MERCADOPAGO_CLIENT_SECRET"]?.trim() });
  return parsed.success ? parsed.data : null;
}

/** PKCE (RFC 7636): o código de autorização só vale junto com o segredo guardado no cookie de quem iniciou. */
export function createPkcePair(): { readonly verifier: string; readonly challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function authorizationUrl(app: MercadoPagoAppConfig, input: { readonly redirectUri: string; readonly state: string; readonly codeChallenge: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", input.state);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

const TokenSchema = z.object({
  access_token: z.string().min(20),
  refresh_token: z.string().min(10),
  user_id: z.union([z.number(), z.string()]).transform(String).pipe(z.string().regex(/^\d{1,20}$/)),
  expires_in: z.number().int().positive(),
  live_mode: z.boolean().optional(),
});

export interface MercadoPagoTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly liveMode: boolean;
}

export class MercadoPagoOAuthError extends Error {
  constructor(message: string, readonly httpStatus: number | null) {
    super(message);
    this.name = "MercadoPagoOAuthError";
  }
}

async function tokenRequest(body: Record<string, string>): Promise<MercadoPagoTokens> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (cause) {
    throw new MercadoPagoOAuthError(cause instanceof Error && cause.name === "TimeoutError" ? "Tempo esgotado ao falar com o Mercado Pago." : "Falha de rede ao falar com o Mercado Pago.", null);
  }
  // Nunca registrar o corpo: contém tokens.
  if (!res.ok) throw new MercadoPagoOAuthError(`Mercado Pago respondeu HTTP ${res.status} na autorização.`, res.status);
  const parsed = TokenSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new MercadoPagoOAuthError("Resposta de autorização do Mercado Pago em formato inesperado.", res.status);
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    userId: parsed.data.user_id,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000),
    liveMode: parsed.data.live_mode ?? true,
  };
}

export function exchangeAuthorizationCode(app: MercadoPagoAppConfig, input: { readonly code: string; readonly redirectUri: string; readonly codeVerifier: string }): Promise<MercadoPagoTokens> {
  return tokenRequest({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, code_verifier: input.codeVerifier });
}

export function refreshAccessToken(app: MercadoPagoAppConfig, refreshToken: string): Promise<MercadoPagoTokens> {
  return tokenRequest({ client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken });
}
