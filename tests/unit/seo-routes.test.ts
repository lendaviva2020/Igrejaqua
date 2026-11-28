import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { absoluteUrl, classifyPath, INDEXABLE_PATHS, siteOrigin } from "@/lib/seo/routes";

const APP_DIR = join(process.cwd(), "src/app");
const isDir = (p: string): boolean => statSync(p).isDirectory();
const childDirs = (p: string): string[] => readdirSync(p).filter((n) => isDir(join(p, n)));

/** Primeiro segmento de URL de cada rota real em src/app (grupos "(x)" não viram segmento). */
function topLevelRoutes(): { group: string; path: string }[] {
  const out: { group: string; path: string }[] = [];
  for (const entry of childDirs(APP_DIR)) {
    if (entry.startsWith("(")) {
      for (const child of childDirs(join(APP_DIR, entry))) out.push({ group: entry, path: `/${child}` });
    } else if (entry === "api") {
      for (const child of childDirs(join(APP_DIR, "api"))) out.push({ group: "api", path: `/api/${child}/x` });
    } else {
      out.push({ group: "root", path: `/${entry}` });
    }
  }
  return out;
}

describe("classificação de rotas", () => {
  it("toda rota existente em src/app está classificada (nada cai em 'unknown' por esquecimento)", () => {
    const unclassified = topLevelRoutes().filter((r) => classifyPath(r.path) === "unknown");
    expect(unclassified).toEqual([]);
  });

  it("áreas autenticadas são protegidas", () => {
    const privateGroups = new Set(["(app)", "(onboarding)", "(stage)"]);
    const leaked = topLevelRoutes().filter((r) => privateGroups.has(r.group) && classifyPath(r.path) !== "protected");
    expect(leaked).toEqual([]);
    for (const p of ["/mfa", "/mfa/configurar", "/redefinir-senha", "/api/ai/schedule", "/api/me/export", "/agenda/123", "/entrar/ABC123"]) expect(classifyPath(p)).toBe("protected");
  });

  it("só home, privacidade e termos são indexáveis; autenticação e APIs públicas não", () => {
    expect(INDEXABLE_PATHS.map(classifyPath)).toEqual(["indexable", "indexable", "indexable"]);
    for (const p of ["/login", "/cadastro", "/recuperar-senha", "/callback", "/offline", "/api/vitals", "/api/webhooks/mercadopago", "/robots.txt", "/sitemap.xml"]) expect(classifyPath(p)).toBe("public-noindex");
  });

  it("caminho inexistente é 'unknown' (vira 404 real, não redirecionamento)", () => {
    for (const p of ["/pagina-inexistente", "/dashboardx", "/agendas", "/privacidade/extra", "/wp-admin"]) expect(classifyPath(p)).toBe("unknown");
  });
});

describe("origem canônica", () => {
  it("usa NEXT_PUBLIC_SITE_URL, depois o domínio de produção da Vercel, depois localhost", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://igrejaqua.com.br/qualquer" })).toBe("https://igrejaqua.com.br");
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "igrejaqua.vercel.app" })).toBe("https://igrejaqua.vercel.app");
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "nao-e-url", VERCEL_PROJECT_PRODUCTION_URL: "igrejaqua.vercel.app" })).toBe("https://igrejaqua.vercel.app");
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBe("http://localhost:3000");
    expect(siteOrigin({})).toBe("http://localhost:3000");
    expect(absoluteUrl("/termos", { NEXT_PUBLIC_SITE_URL: "https://a.b" })).toBe("https://a.b/termos");
  });
});

describe("robots.txt e sitemap.xml", () => {
  it("robots libera o site, bloqueia só /api/ e aponta o sitemap absoluto", () => {
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/"] }]);
    expect(r.sitemap).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/);
  });

  it("sitemap lista apenas as URLs indexáveis, absolutas e sem duplicatas", () => {
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(["/", "/privacidade", "/termos"]);
    expect(new Set(urls).size).toBe(urls.length);
    for (const e of entries) expect(e.url).toMatch(/^https?:\/\//);
    // A home não tem data editorial confiável: não declara lastModified.
    expect(entries[0]?.lastModified).toBeUndefined();
    expect(entries[1]?.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
