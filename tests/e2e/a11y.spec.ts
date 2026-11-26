import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROTAS_PUBLICAS = ["/", "/login", "/cadastro", "/recuperar-senha", "/privacidade", "/termos"] as const;

test.describe("acessibilidade (axe, WCAG 2.1 A/AA) nas rotas públicas", () => {
  for (const rota of ROTAS_PUBLICAS) {
    test(`sem violações em ${rota}`, async ({ page }) => {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const resumo = resultado.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(resumo).toEqual([]);
    });
  }
});
