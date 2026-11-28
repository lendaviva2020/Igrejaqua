import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Cookie temporário do OAuth: amarra o retorno à mesma pessoa, igreja e navegador que iniciaram (CSRF + PKCE). */
export const OAUTH_COOKIE = "iq_mp_oauth";
export const OAUTH_COOKIE_PATH = "/api/payments/mercadopago";
export const OAUTH_COOKIE_MAX_AGE = 600;

const CookieSchema = z.object({ state: z.string().min(20).max(100), verifier: z.string().min(43).max(128), churchId: z.string().uuid(), userId: z.string().uuid() }).strict();
export type OAuthCookie = z.infer<typeof CookieSchema>;

export function encodeOAuthCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (raw === undefined) return null;
  try {
    const parsed = CookieSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Comparação em tempo constante do "state" devolvido pelo Mercado Pago. */
export function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
