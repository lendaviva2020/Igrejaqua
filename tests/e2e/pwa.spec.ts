import { expect, test } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest válido com ícones existentes", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as { icons: { src: string; purpose: string }[]; start_url: string; display: string };
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test("service worker é servido sem cache e a página /offline é pública", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    expect((await request.get("/offline", { maxRedirects: 0 })).status()).toBe(200);
  });

  test("sem rede, a navegação cai na página offline; rotas protegidas nunca são cacheadas", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    // Recarrega para que a página fique sob controle do service worker.
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
      return urls;
    });
    expect(cached).toContain("/offline");
    expect(cached.some((p) => p === "/dashboard" || p === "/membros" || p === "/configuracoes")).toBe(false);
    await context.setOffline(true);
    await page.goto("/dashboard").catch(() => undefined);
    await expect(page.getByRole("heading", { level: 1, name: "Sem conexão no momento" })).toBeVisible();
    await context.setOffline(false);
  });

  test("CLEAR_CACHES apaga os caches do service worker", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await page.evaluate(async () => {
      const cache = await caches.open("iq-stage-v1");
      await cache.put("/palco/teste", new Response("x"));
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHES" });
    });
    await expect.poll(() => page.evaluate(async () => (await caches.has("iq-stage-v1")))).toBe(false);
  });
});
