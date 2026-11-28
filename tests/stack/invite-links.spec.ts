import { expect, test } from "@playwright/test";
import { STATE } from "./helpers.ts";

/**
 * Links de convite: saem com a URL pública do app (aqui, a do ambiente de teste), nunca com um
 * endereço fixo; "Copiar link" copia a URL completa; o link da igreja abre a tela de pedido de entrada.
 */
const BASE = process.env["IQ_EXPECTED_APP_URL"] ?? "http://localhost:3160";
const escaped = BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.describe("administração gera e copia os links", () => {
  test.use({ storageState: STATE("admin") });

  test("link da igreja: URL completa da instância e cópia idêntica", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/membros");
    const gerar = page.getByRole("button", { name: "Gerar link da igreja" });
    if (await gerar.isVisible()) await gerar.click();
    else await page.getByRole("button", { name: "Gerar novo link" }).click();
    const input = page.getByRole("textbox", { name: "Link da igreja" });
    await expect(input).toHaveValue(new RegExp(`^${escaped}/entrar/[A-Za-z0-9_-]{43}$`));
    const link = await input.inputValue();
    await page.getByRole("button", { name: "Copiar link" }).first().click();
    await expect(page.getByRole("button", { name: "Copiado" }).first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  });

  test("convite individual: URL completa com o token", async ({ page }) => {
    await page.goto("/membros");
    await page.getByLabel("E-mail da pessoa").fill(`convidado+${Date.now()}@teste.local`);
    await page.getByRole("button", { name: "Gerar convite" }).click();
    await expect(page.getByLabel("Link do convite")).toHaveValue(new RegExp(`^${escaped}/selecionar-igreja\\?convite=[A-Za-z0-9_-]{43}$`));
  });
});

test.describe("quem recebe o link", () => {
  test.use({ storageState: STATE("leader") });
  test("abre o link da igreja e vê a tela de pedido de entrada", async ({ page, browser }) => {
    const admin = await browser.newContext({ storageState: STATE("admin") });
    const adminPage = await admin.newPage();
    await adminPage.goto("/membros");
    const link = await adminPage.getByRole("textbox", { name: "Link da igreja" }).inputValue();
    await admin.close();
    expect(link.startsWith(`${BASE}/entrar/`)).toBe(true);

    await page.goto(new URL(link).pathname);
    await expect(page.getByRole("heading", { name: "Você recebeu o link de uma igreja" })).toBeVisible();
  });
});
