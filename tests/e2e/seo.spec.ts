import { expect, test } from "@playwright/test";

/** SEO técnico e status HTTP das rotas públicas (sem backend). Roda uma vez (projeto desktop). */
test.describe("SEO técnico", () => {
  test.skip(({ isMobile }) => isMobile, "verificações de HTTP independem do dispositivo: roda só no desktop");

  test("robots.txt: 200, libera o site, bloqueia /api/ e aponta o sitemap", async ({ request }) => {
    const r = await request.get("/robots.txt");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("text/plain");
    const body = await r.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Allow: \//);
    expect(body).toMatch(/Disallow: \/api\//);
    expect(body).not.toMatch(/Disallow: \/_next/);
    expect(body).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
  });

  test("sitemap.xml: 200, XML válido, só URLs indexáveis e cada uma responde 200 com canônica igual", async ({ request, page }) => {
    const r = await request.get("/sitemap.xml");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("xml");
    const xml = await r.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
    expect(locs.map((u) => new URL(u).pathname)).toEqual(["/", "/privacidade", "/termos"]);
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      expect(res?.headers()["x-robots-tag"], `${path} não pode ter noindex`).toBeUndefined();
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical && new URL(canonical).pathname, `canônica de ${path}`).toBe(path);
      expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
    }
  });

  test("títulos únicos e descrições nas páginas públicas indexáveis", async ({ page }) => {
    const titles = new Set<string>();
    for (const path of ["/", "/privacidade", "/termos"]) {
      await page.goto(path);
      const title = await page.title();
      expect(title.length, `título de ${path}`).toBeGreaterThan(10);
      expect(title.length, `título de ${path} curto o bastante`).toBeLessThanOrEqual(65);
      titles.add(title);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0, `descrição de ${path}`).toBeGreaterThan(50);
      expect(await page.locator("h1").count(), `um único h1 em ${path}`).toBe(1);
    }
    expect(titles.size).toBe(3);
  });

  test("home: JSON-LD Organization + WebSite válido, sem sameAs inventado", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw ?? "{}") as { "@context": string; "@graph": { "@type": string; sameAs?: string[]; url: string }[] };
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"].map((n) => n["@type"])).toEqual(["Organization", "WebSite"]);
    for (const url of data["@graph"][0]?.sameAs ?? []) expect(url).toMatch(/^https:\/\//);
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBeTruthy();
  });

  test("rota inexistente responde 404 real (sem redirecionar para login ou home) e com noindex", async ({ request, page }) => {
    for (const path of ["/pagina-que-nao-existe", "/agendas", "/privacidade/extra"]) {
      const r = await request.get(path, { maxRedirects: 0 });
      expect(r.status(), path).toBe(404);
      expect(r.headers()["x-robots-tag"]).toContain("noindex");
    }
    await page.goto("/pagina-que-nao-existe");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
    await expect(page.getByRole("link", { name: "Página inicial", exact: true })).toHaveAttribute("href", "/");
  });

  test("área privada: redireciona ao login com noindex; telas de autenticação não são indexáveis", async ({ request, page }) => {
    const r = await request.get("/dashboard", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toContain("/login?next=%2Fdashboard");
    expect(r.headers()["x-robots-tag"]).toContain("noindex");
    for (const path of ["/login", "/cadastro", "/recuperar-senha"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(res?.headers()["x-robots-tag"]).toContain("noindex");
      expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
      expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
    }
  });

  test("redirecionamentos: barra final usa 308 em um salto, sem cadeia", async ({ request }) => {
    const r = await request.get("/termos/", { maxRedirects: 0 });
    expect(r.status()).toBe(308);
    expect(r.headers()["location"]).toBe("/termos");
    const final = await request.get("/termos/");
    expect(final.status()).toBe(200);
  });

  test("links internos das páginas públicas usam href real e não estão quebrados", async ({ page, request }) => {
    const checked = new Set<string>();
    for (const path of ["/", "/privacidade", "/termos", "/login", "/cadastro"]) {
      await page.goto(path);
      const hrefs = await page.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs.filter((h) => h === null || h === "" || h === "#"), `âncoras sem destino em ${path}`).toEqual([]);
      for (const href of hrefs) {
        if (href === null || !href.startsWith("/") || href.startsWith("//") || checked.has(href)) continue;
        checked.add(href);
        const res = await request.get(href);
        expect(res.status(), `link ${href} em ${path}`).toBeLessThan(400);
      }
    }
    expect(checked.size).toBeGreaterThan(3);
  });

  test("imagens públicas têm alt (vazio só para decorativas) e dimensões reservadas", async ({ page }) => {
    for (const path of ["/", "/login", "/privacidade"]) {
      await page.goto(path);
      const imgs = await page.locator("img").evaluateAll((list) => list.map((i) => ({ alt: i.getAttribute("alt"), w: i.getAttribute("width"), h: i.getAttribute("height") })));
      for (const img of imgs) {
        expect(img.alt, `alt ausente em ${path}`).not.toBeNull();
        expect(img.w !== null && img.h !== null, `dimensões em ${path}`).toBe(true);
      }
    }
  });

  test("/api/vitals: aceita métrica válida (204), recusa inválida (422) e pedidos de outros sites (403)", async ({ request }) => {
    const ok = await request.post("/api/vitals", { data: { name: "LCP", value: 1200, rating: "good", route: "/" } });
    expect(ok.status()).toBe(204);
    const bad = await request.post("/api/vitals", { data: { name: "LCP", value: 1200, route: "/agenda?email=x" } });
    expect(bad.status()).toBe(422);
    const cross = await request.post("/api/vitals", { data: { name: "LCP", value: 1, route: "/" }, headers: { "sec-fetch-site": "cross-site" } });
    expect(cross.status()).toBe(403);
  });
});
