import { expect, test } from "@playwright/test";

test.describe("rotas públicas e guardas (sem backend)", () => {
  test("home institucional carrega e hidrata sem violar a CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "IGREJAQUA" })).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("rota protegida redireciona ao login preservando o destino", async ({ page }) => {
    await page.goto("/ministerios");
    await expect(page).toHaveURL(/\/login\?next=%2Fministerios$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("cabeçalhos de segurança presentes", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("login valida no cliente (JS hidratado sob CSP) e mostra erros acessíveis", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nao-e-email");
    await page.getByLabel("Senha").fill("x");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail inválido")).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("cadastro exige senha forte", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill("Ana Souza");
    await page.getByLabel("E-mail").fill("ana@example.com");
    await page.getByLabel("Senha").fill("curta");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Use ao menos 12 caracteres")).toBeVisible();
  });

  test("navegação por teclado alcança os campos do login", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Senha")).toBeFocused();
  });

  test("webhook do Pix é público (não redireciona ao login) e nunca aceita sem configuração/assinatura", async ({ request }) => {
    const res = await request.post("/api/webhooks/mercadopago?data.id=123&type=payment", { data: { type: "payment", data: { id: "123" } }, maxRedirects: 0 });
    expect([401, 503]).toContain(res.status());
  });
  test("webhook rejeita GET", async ({ request }) => {
    const res = await request.get("/api/webhooks/mercadopago", { maxRedirects: 0 });
    expect(res.status()).toBe(405);
  });
});
