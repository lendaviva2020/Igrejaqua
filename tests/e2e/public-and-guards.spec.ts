import { expect, test } from "@playwright/test";

test.describe("rotas públicas e guardas (sem backend)", () => {
  test("home institucional carrega e hidrata sem violar a CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("pessoas unidas");
    expect(violations).toEqual([]);
  });

  test("rota protegida redireciona ao login preservando o destino", async ({ page }) => {
    await page.goto("/ministerios");
    await expect(page).toHaveURL(/\/login\?next=%2Fministerios$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("painel de membros e seleção de igreja exigem login; o link de convite preserva o token", async ({ page }) => {
    await page.goto("/membros");
    await expect(page).toHaveURL(/\/login\?next=%2Fmembros$/);
    await page.goto("/configuracoes");
    await expect(page).toHaveURL(/\/login\?next=%2Fconfiguracoes$/);
    const exp = await page.request.get("/api/me/export", { maxRedirects: 0 });
    expect(exp.status()).toBe(307);
    await page.goto("/ministerios/11111111-1111-4111-8111-111111111111");
    await expect(page).toHaveURL(/\/login\?next=%2Fministerios%2F/);
    await page.goto("/selecionar-igreja?convite=abc123");
    await expect(page).toHaveURL(/\/login\?next=%2Fselecionar-igreja%3Fconvite%3Dabc123$/);
  });

  test("rotas de IA exigem login (sem sessão não chegam ao provedor)", async ({ request }) => {
    const gerar = await request.post("/api/ai/schedule", { data: { sessionId: "11111111-1111-4111-8111-111111111111", slots: [{ function: "voz", count: 1 }] }, maxRedirects: 0 });
    expect(gerar.status()).toBe(307);
    const aceitar = await request.post("/api/ai/runs/11111111-1111-4111-8111-111111111111", { data: { action: "accept" }, maxRedirects: 0 });
    expect(aceitar.status()).toBe(307);
  });

  test("trabalhador de entrega só responde com segredo; /mfa exige login", async ({ request, page }) => {
    const sem = await request.get("/api/cron/deliver", { maxRedirects: 0 });
    expect([401, 503]).toContain(sem.status());
    expect(sem.headers()["cache-control"]).toBe("no-store");
    const errado = await request.post("/api/cron/deliver", { headers: { authorization: "Bearer segredo-errado-segredo-errado" }, maxRedirects: 0 });
    expect([401, 503]).toContain(errado.status());
    await page.goto("/mfa");
    await expect(page).toHaveURL(/\/login\?next=%2Fmfa$/);
    await page.goto("/biblia/joao/3");
    await expect(page).toHaveURL(/\/login\?next=%2Fbiblia%2Fjoao%2F3$/);
    await page.goto("/mfa/configurar");
    await expect(page).toHaveURL(/\/login\?next=%2Fmfa%2Fconfigurar$/);
  });

  test("landing, privacidade e termos são públicos e sem dados fictícios", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar conta da igreja" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Redes sociais" })).toHaveCount(0);
    for (const [path, titulo] of [["/privacidade", "Política de Privacidade"], ["/termos", "Termos de Uso"]] as const) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    }
  });

  test("login sem Google configurado não mostra o botão; nova senha exige sessão", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Esqueci a senha" })).toBeVisible();
    await page.goto("/redefinir-senha");
    await expect(page).toHaveURL(/\/login\?next=%2Fredefinir-senha$/);
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
