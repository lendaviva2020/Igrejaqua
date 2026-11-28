import { describe, expect, it } from "vitest";
import { joinAppUrl, resolveAppBaseUrl } from "@/lib/app-url";
import { invitationUrl, joinLinkUrl } from "@/modules/members/token";

const TOKEN = "19tK5WpeGxeS0EWGOTkB0TIUZXeUeVt7T_wCHt8FO8E";
/** Ambiente real da Vercel em produção HOJE: sem NEXT_PUBLIC_SITE_URL (a causa do bug). */
const VERCEL_PROD = { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "igrejaqua.vercel.app", VERCEL_URL: "igrejaqua-abc123-felipe.vercel.app" };

describe("URL base do app", () => {
  it("bug corrigido: na Vercel sem variável explícita, usa o domínio de produção (nunca localhost)", () => {
    expect(resolveAppBaseUrl(VERCEL_PROD)).toBe("https://igrejaqua.vercel.app");
    expect(joinLinkUrl(resolveAppBaseUrl(VERCEL_PROD) ?? "", TOKEN)).toBe(`https://igrejaqua.vercel.app/entrar/${TOKEN}`);
  });

  it("localhost esquecido na configuração da Vercel é ignorado", () => {
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe("https://igrejaqua.vercel.app");
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000/" })).toBe("https://igrejaqua.vercel.app");
  });

  it("variável explícita vence (domínio próprio), sem barra final e só https para domínio público", () => {
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "https://igrejaqua.com.br/" })).toBe("https://igrejaqua.com.br");
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_APP_URL: "https://app.igrejaqua.com.br", NEXT_PUBLIC_SITE_URL: "https://igrejaqua.com.br" })).toBe("https://app.igrejaqua.com.br");
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "http://igrejaqua.com.br" })).toBe("https://igrejaqua.vercel.app");
    expect(resolveAppBaseUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBe("https://igrejaqua.vercel.app");
  });

  it("preview da Vercel usa o endereço da branch/deploy", () => {
    expect(resolveAppBaseUrl({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "igrejaqua-git-dev-felipe.vercel.app", VERCEL_URL: "igrejaqua-xyz.vercel.app" })).toBe("https://igrejaqua-git-dev-felipe.vercel.app");
    expect(resolveAppBaseUrl({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "igrejaqua-xyz.vercel.app" })).toBe("https://igrejaqua-xyz.vercel.app");
  });

  it("fora da Vercel: cabeçalhos da requisição (domínio público sempre https; host inválido recusado)", () => {
    expect(resolveAppBaseUrl({ NODE_ENV: "production" }, { forwardedHost: "igreja.exemplo.org, proxy.interno", forwardedProto: "http" })).toBe("https://igreja.exemplo.org");
    expect(resolveAppBaseUrl({ NODE_ENV: "production" }, { host: "igreja.exemplo.org" })).toBe("https://igreja.exemplo.org");
    expect(resolveAppBaseUrl({ NODE_ENV: "production" }, { host: "evil.com/@x" })).toBeNull();
    expect(resolveAppBaseUrl({ NODE_ENV: "production" }, { host: "a<b>.com" })).toBeNull();
  });

  it("desenvolvimento local usa localhost; produção sem nada devolve null (não gera link quebrado)", () => {
    expect(resolveAppBaseUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(resolveAppBaseUrl({ NODE_ENV: "development" }, { host: "localhost:3005" })).toBe("http://localhost:3005");
    expect(resolveAppBaseUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3160" })).toBe("http://localhost:3160");
    expect(resolveAppBaseUrl({ NODE_ENV: "production" })).toBeNull();
  });

  it("convite individual e junção de caminhos com uma única barra", () => {
    expect(invitationUrl("https://igrejaqua.vercel.app/", TOKEN)).toBe(`https://igrejaqua.vercel.app/selecionar-igreja?convite=${TOKEN}`);
    expect(joinAppUrl("https://a.b//", "//callback?next=/x")).toBe("https://a.b/callback?next=/x");
  });
});
