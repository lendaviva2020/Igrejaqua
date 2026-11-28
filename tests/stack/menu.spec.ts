import { expect, test } from "@playwright/test";
import { STATE } from "./helpers.ts";

/** Menu do celular: todo módulo permitido é alcançável, e nada que a página negaria aparece. */
const ADMIN_MODULES = ["Painel", "Notificações", "Agenda", "Repertório", "Ministérios", "Disponibilidade", "Oração", "Comunicados", "Células", "Famílias", "Visitantes", "Membros", "Bíblia", "Contribuir", "Financeiro", "Configurações"];
const MEMBER_HIDDEN = ["Famílias", "Visitantes", "Membros", "Financeiro"];

test.describe("menu do celular — administração", () => {
  test.use({ storageState: STATE("admin") });
  test("abre com todos os 16 módulos, navega e fecha; Esc também fecha", async ({ page }) => {
    await page.goto("/dashboard");
    const menu = page.getByRole("button", { name: /Menu/ });
    await menu.click();
    const sheet = page.getByRole("dialog", { name: "Igreja de Teste" });
    await expect(sheet).toBeVisible();
    for (const label of ADMIN_MODULES) await expect(sheet.getByRole("link", { name: label, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await menu.click();
    await sheet.getByRole("link", { name: "Financeiro", exact: true }).click();
    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(sheet).toBeHidden();
    // Fora dos 4 destinos fixos, o botão Menu indica onde a pessoa está.
    await expect(menu).toHaveClass(/text-ambar-claro/);
  });
});

test.describe("menu do celular — membro", () => {
  test.use({ storageState: STATE("member") });
  test("não mostra módulos que a página negaria", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Menu/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: "Bíblia", exact: true })).toBeVisible();
    for (const label of MEMBER_HIDDEN) await expect(sheet.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Sair da conta" })).toBeVisible();
  });
});
