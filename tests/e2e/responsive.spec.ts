import { expect, test } from "@playwright/test";

/** Matriz de tamanhos reais de aparelhos (largura × altura, em CSS px). */
const VIEWPORTS: readonly { name: string; width: number; height: number }[] = [
  { name: "celular pequeno (320)", width: 320, height: 568 },
  { name: "celular (375)", width: 375, height: 667 },
  { name: "celular grande (430)", width: 430, height: 932 },
  { name: "celular paisagem", width: 844, height: 390 },
  { name: "tablet retrato (768)", width: 768, height: 1024 },
  { name: "tablet paisagem (1024)", width: 1024, height: 768 },
  { name: "notebook (1366)", width: 1366, height: 768 },
  { name: "desktop (1920)", width: 1920, height: 1080 },
  { name: "ultralargo (2560)", width: 2560, height: 1440 },
];
const ROUTES = ["/", "/login", "/cadastro", "/recuperar-senha", "/termos", "/privacidade", "/offline"] as const;

for (const vp of VIEWPORTS) {
  test.describe(`responsividade — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const route of ROUTES) {
      test(`${route}: sem rolagem horizontal e conteúdo visível`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("main, [role=main], body").first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `rolagem horizontal de ${overflow}px`).toBeLessThanOrEqual(0);
        // Nenhum elemento pode vazar para fora da largura da janela.
        const leaking = await page.evaluate(() => {
          const w = document.documentElement.clientWidth;
          // Elementos recortados por um ancestral com overflow (ex.: brilhos decorativos) não são visíveis fora da tela.
          const clipped = (el: HTMLElement): boolean => {
            for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") return true;
            }
            return false;
          };
          return [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed" && !clipped(el); })
            .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        });
        expect(leaking, `elementos fora da tela: ${leaking.join(", ")}`).toEqual([]);
      });
      test(`${route}: alvos interativos com pelo menos 24px (WCAG 2.5.8)`, async ({ page }) => {
        await page.goto(route);
        const small = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("button, [role=button], input:not([type=hidden]), select, textarea")]
            .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); })
            .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 20)}`));
        expect(small, `alvos pequenos: ${small.join(", ")}`).toEqual([]);
      });
    }
  });
}
