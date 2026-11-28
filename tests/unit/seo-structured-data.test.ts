import { describe, expect, it } from "vitest";
import { normalizeRoute, webVitalSchema } from "@/lib/perf/web-vitals";
import { formatLegalDate } from "@/lib/seo/content-dates";
import { buildHomeStructuredData, serializeJsonLd } from "@/lib/seo/structured-data";
import { siteConfig } from "@/lib/site";

const ENV = { NEXT_PUBLIC_SITE_URL: "https://igrejaqua.example" };

describe("JSON-LD da home", () => {
  it("sem redes configuradas, não declara sameAs nem contato (nada inventado)", () => {
    const data = buildHomeStructuredData(siteConfig({}), ENV);
    const [org, site] = data["@graph"];
    expect(org.name).toBe("IGREJAQUA");
    expect(org.url).toBe("https://igrejaqua.example/");
    expect(org.logo.url).toBe("https://igrejaqua.example/icons/icon-512.png");
    expect(org).not.toHaveProperty("sameAs");
    expect(org).not.toHaveProperty("contactPoint");
    expect(site.publisher["@id"]).toBe(org["@id"]);
  });

  it("sameAs só com URLs https configuradas; http e valores inválidos são descartados", () => {
    const site = siteConfig({ NEXT_PUBLIC_SOCIAL_INSTAGRAM: "https://instagram.com/igrejaqua", NEXT_PUBLIC_SOCIAL_YOUTUBE: "http://youtube.com/x", NEXT_PUBLIC_CONTACT_EMAIL: "contato@igrejaqua.example" });
    const [org] = buildHomeStructuredData(site, ENV)["@graph"];
    // siteConfig descarta tudo que não é https: o perfil http nunca entra no sameAs.
    expect(org.sameAs ?? []).not.toContain("http://youtube.com/x");
    for (const url of org.sameAs ?? []) expect(url.startsWith("https://")).toBe(true);
  });

  it("serialização é JSON válido e não permite fechar a tag <script>", () => {
    const site = siteConfig({ NEXT_PUBLIC_SOCIAL_INSTAGRAM: "https://instagram.com/</script><script>alert(1)</script>" });
    const html = serializeJsonLd(buildHomeStructuredData(site, ENV));
    expect(html).not.toContain("<");
    expect(html).not.toContain(">");
    const parsed = JSON.parse(html) as { "@context": string };
    expect(parsed["@context"]).toBe("https://schema.org");
  });
});

describe("datas das páginas legais", () => {
  it("formata a data ISO em português, sem deslocamento de fuso", () => {
    expect(formatLegalDate("2026-11-26")).toBe("26 de novembro de 2026");
  });
});

describe("Web Vitals", () => {
  it("normaliza a rota sem vazar ids nem códigos de convite", () => {
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/agenda")).toBe("/agenda");
    expect(normalizeRoute("/agenda/f355b637-6563-4fab-b9e0-338d347f7cc3")).toBe("/agenda/:param");
    expect(normalizeRoute("/entrar/CODIGO-SECRETO")).toBe("/entrar/:param");
    expect(normalizeRoute("/biblia/joao/3")).toBe("/biblia/:param/:param");
    expect(normalizeRoute("/Usuário@email.com")).toBe("/:param");
  });

  it("aceita só métricas conhecidas, com valores finitos e rota normalizada", () => {
    expect(webVitalSchema.safeParse({ name: "LCP", value: 1820, rating: "good", navigationType: "navigate", route: "/agenda/:param" }).success).toBe(true);
    expect(webVitalSchema.safeParse({ name: "LCP", value: -1, route: "/" }).success).toBe(false);
    expect(webVitalSchema.safeParse({ name: "XSS", value: 1, route: "/" }).success).toBe(false);
    expect(webVitalSchema.safeParse({ name: "CLS", value: 0.01, route: "/agenda?email=a@b.c" }).success).toBe(false);
    expect(webVitalSchema.safeParse({ name: "CLS", value: 0.01, route: "/", userId: "x" }).success).toBe(false);
  });
});
