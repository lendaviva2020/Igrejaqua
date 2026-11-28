import { expect, test } from "@playwright/test";
import { STATE } from "./helpers.ts";

/** Biblioteca aberta: buscar, adicionar ao repertório com crédito/licença e abrir a cifra. */
test.describe("Biblioteca aberta", () => {
  test.use({ storageState: STATE("admin") });

  test("busca em português, adiciona e a música abre com cifra, crédito e link da fonte", async ({ page }) => {
    await page.goto("/repertorio");
    await page.getByRole("link", { name: "Biblioteca aberta" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Biblioteca aberta" })).toBeVisible();
    await page.getByLabel("Buscar").fill("marchando");
    await page.getByLabel("Língua").selectOption("pt");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByText("1 música encontrada")).toBeVisible();
    await page.getByRole("button", { name: "Adicionar Marchando vem Jesus! ao repertório" }).click();
    await expect(page).toHaveURL(/\/repertorio\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Marchando vem Jesus!");
    await expect(page.getByText("Licença: Domínio público")).toBeVisible();
    await expect(page.getByText(/The Cyber Hymnal/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Ouvir referência/ })).toHaveAttribute("href", /worshipcommons\.org\/songs\//);

    // Voltando à biblioteca, a música aparece como já adicionada.
    await page.goto("/repertorio/biblioteca?q=marchando&lingua=pt&cifra=sim");
    await expect(page.getByText("Já está no repertório")).toBeVisible();
  });

  test("o catálogo (2 MB) não vai para o navegador", async ({ page }) => {
    let bytes = 0;
    page.on("response", async (r) => { if (r.url().includes("/_next/static/")) bytes += (await r.body().catch(() => Buffer.alloc(0))).length; });
    await page.goto("/repertorio/biblioteca", { waitUntil: "networkidle" });
    const html = await page.content();
    expect(html).not.toContain("worshipcommons.org/songs/orlormneXN3\",\"hasChords");
    expect(bytes).toBeLessThan(1_500_000);
  });
});

test.describe("Biblioteca aberta — membro", () => {
  test.use({ storageState: STATE("member") });
  test("membro vê a biblioteca, mas não o botão de adicionar", async ({ page }) => {
    await page.goto("/repertorio/biblioteca?q=castelo&lingua=pt&cifra=todas");
    await expect(page.getByRole("heading", { name: "Castelo Forte" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar/ })).toHaveCount(0);
  });
});
