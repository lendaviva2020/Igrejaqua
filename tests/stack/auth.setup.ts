import { expect, test } from "@playwright/test";
import { completeAdminMfa, login, STATE, USERS } from "./helpers.ts";

test("administrador: login → MFA obrigatório → painel", async ({ page }) => {
  await login(page, USERS.admin);
  await completeAdminMfa(page);
  await expect(page.getByRole("heading", { name: /Bem-vindo/ })).toBeVisible();
  await page.context().storageState({ path: STATE("admin") });
});

for (const who of ["leader", "member"] as const) {
  test(`${who}: login → painel`, async ({ page }) => {
    await login(page, USERS[who]);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.context().storageState({ path: STATE(who) });
  });
}
