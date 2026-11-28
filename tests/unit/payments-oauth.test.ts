import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("cifra dos tokens das igrejas", async () => {
  const { decryptToken, encryptToken, loadTokenKey, TokenKeyMissingError } = await import("@/lib/payments/token-crypto");
  const key = randomBytes(32);
  it("ida e volta; cada cifra é diferente; adulteração é detectada", () => {
    const a = encryptToken("APP_USR-segredo", key);
    const b = encryptToken("APP_USR-segredo", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("segredo");
    expect(decryptToken(a, key)).toBe("APP_USR-segredo");
    const [v, iv, tag, data] = a.split(".");
    const tampered = [v, iv, tag, `${(data ?? "").slice(0, -2)}AA`].join(".");
    expect(() => decryptToken(tampered, key)).toThrow();
    expect(() => decryptToken(a, randomBytes(32))).toThrow();
  });
  it("sem chave válida, recusa (nunca grava token em claro)", () => {
    expect(() => loadTokenKey({})).toThrow(TokenKeyMissingError);
    expect(() => loadTokenKey({ MERCADOPAGO_TOKEN_KEY: Buffer.alloc(16).toString("base64") })).toThrow(TokenKeyMissingError);
    expect(loadTokenKey({ MERCADOPAGO_TOKEN_KEY: key.toString("base64") }).length).toBe(32);
  });
});

describe("OAuth do Mercado Pago (conta de cada igreja)", async () => {
  const oauth = await import("@/lib/payments/mercadopago-oauth");
  const cookie = await import("@/lib/payments/mercadopago-oauth-cookie");
  const app = { clientId: "1234567890", clientSecret: "segredo-do-app-123456" };
  afterEach(() => vi.unstubAllGlobals());

  it("sem client id/secret, a conexão fica indisponível", () => {
    expect(oauth.mercadoPagoAppConfig({})).toBeNull();
    expect(oauth.mercadoPagoAppConfig({ MERCADOPAGO_CLIENT_ID: "123456789", MERCADOPAGO_CLIENT_SECRET: "x".repeat(20) })).not.toBeNull();
  });

  it("URL de autorização com state e PKCE S256", () => {
    const pkce = oauth.createPkcePair();
    const url = new URL(oauth.authorizationUrl(app, { redirectUri: "https://igrejaqua.vercel.app/api/payments/mercadopago/callback", state: "estado-unico", codeChallenge: pkce.challenge }));
    expect(url.origin).toBe("https://auth.mercadopago.com.br");
    expect(url.searchParams.get("client_id")).toBe(app.clientId);
    expect(url.searchParams.get("state")).toBe("estado-unico");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(pkce.verifier).not.toBe(pkce.challenge);
  });

  it("troca o código pelas credenciais da conta da igreja", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "APP_USR-123-token-da-igreja", refresh_token: "TG-refresh-123", user_id: 987654321, expires_in: 15552000, live_mode: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = await oauth.exchangeAuthorizationCode(app, { code: "TG-codigo", redirectUri: "https://x.y/cb", codeVerifier: "v".repeat(50) });
    expect(t.userId).toBe("987654321");
    expect(t.accessToken).toBe("APP_USR-123-token-da-igreja");
    expect(t.expiresAt.getTime()).toBeGreaterThan(Date.now() + 170 * 24 * 3600 * 1000);
    const body = String((fetchMock.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code_verifier=");
  });

  it("erro do provedor não vaza corpo nem token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "invalid_grant", access_token: "nao-vazar" }), { status: 400 })));
    await expect(oauth.exchangeAuthorizationCode(app, { code: "x", redirectUri: "https://x.y/cb", codeVerifier: "v".repeat(50) })).rejects.toThrow(/HTTP 400/);
    await expect(oauth.refreshAccessToken(app, "r")).rejects.not.toThrow(/nao-vazar/);
  });

  it("cookie do OAuth: só aceita o formato esperado; state comparado com segurança", () => {
    const v = { state: "s".repeat(32), verifier: "v".repeat(64), churchId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
    expect(cookie.decodeOAuthCookie(cookie.encodeOAuthCookie(v))).toEqual(v);
    expect(cookie.decodeOAuthCookie("lixo")).toBeNull();
    expect(cookie.decodeOAuthCookie(Buffer.from(JSON.stringify({ ...v, extra: 1 })).toString("base64url"))).toBeNull();
    expect(cookie.sameState("abc", "abc")).toBe(true);
    expect(cookie.sameState("abc", "abd")).toBe(false);
    expect(cookie.sameState("abc", "abcd")).toBe(false);
  });

  it("segredo do webhook é do aplicativo; sem ele, webhooks desligados", async () => {
    const { mercadoPagoWebhookSecret } = await import("@/lib/payments/mercadopago");
    expect(mercadoPagoWebhookSecret({})).toBeNull();
    expect(mercadoPagoWebhookSecret({ MERCADOPAGO_WEBHOOK_SECRET: "segredo-123" })).toBe("segredo-123");
  });
});
