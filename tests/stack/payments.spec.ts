import { expect, test } from "@playwright/test";
import { STATE } from "./helpers.ts";

/**
 * Contribuições na conta DE CADA IGREJA (Fase 1: chave Pix da igreja). Roda em série: a administração
 * cadastra a chave, o membro gera o Pix e a tesouraria confirma.
 */
test.describe.configure({ mode: "serial" });

test.describe("administração cadastra a chave Pix da igreja", () => {
  test.use({ storageState: STATE("admin") });
  test("CNPJ inválido é recusado; válido é salvo e exibido", async ({ page }) => {
    await page.goto("/configuracoes#contribuicoes");
    const section = page.locator("#contribuicoes");
    await expect(section.getByText("direto para a conta da igreja")).toBeVisible();
    if (await section.getByRole("button", { name: "Trocar chave" }).isVisible()) await section.getByRole("button", { name: "Trocar chave" }).click();
    await section.getByLabel("Tipo da chave").selectOption("cnpj");
    await section.getByRole("textbox", { name: "Chave Pix", exact: true }).fill("11.222.333/0001-82");
    await section.getByLabel("Nome do recebedor").fill("Igreja de Teste");
    await section.getByLabel("Cidade").fill("São Paulo");
    await section.getByRole("button", { name: "Salvar chave Pix" }).click();
    await expect(section.getByText("CNPJ inválido. Confira os 14 números.").first()).toBeVisible();
    await section.getByRole("textbox", { name: "Chave Pix", exact: true }).fill("11.222.333/0001-81");
    await section.getByRole("button", { name: "Salvar chave Pix" }).click();
    await expect(section.getByText("CNPJ: 11.222.333/0001-81")).toBeVisible();
    await expect(section.getByText("Chave Pix da igreja (a tesouraria confirma)")).toBeVisible();
    // Sem o aplicativo do Mercado Pago configurado no servidor, a conexão aparece como indisponível.
    await expect(section.getByText(/Ainda não disponível/)).toBeVisible();
  });
});

test.describe("membro contribui pela chave da igreja", () => {
  test.use({ storageState: STATE("member") });
  test("o Pix é gerado com a chave e o nome da igreja e aguarda a tesouraria", async ({ page }) => {
    await page.goto("/contribuir");
    await page.getByLabel("Outro valor (R$)").fill("50,00");
    await page.getByRole("button", { name: "Gerar Pix" }).click();
    await expect(page).toHaveURL(/\/contribuir\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Aguardando confirmação da tesouraria")).toBeVisible();
    await expect(page.getByText(/confira o recebedor: Igreja de Teste/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar código Pix (copia e cola)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar recebimento" })).toHaveCount(0);
    await expect(page.getByText(/Identificador: IQ[A-Z0-9]{23}/)).toBeVisible();
  });
});

test.describe("tesouraria confere e confirma", () => {
  test.use({ storageState: STATE("admin") });
  test("contribuição pendente aparece para conferência e é confirmada", async ({ page }) => {
    await page.goto("/contribuir");
    await expect(page.getByText(/aguarda(m)? a sua conferência/)).toBeVisible();
    await page.getByRole("link", { name: /Conferir recebimento/ }).first().click();
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect(page.getByText("Pagamento confirmado. Obrigado pela sua contribuição!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Estornar contribuição" })).toHaveCount(0);
  });
});

test.describe("conexão do Mercado Pago (proteções)", () => {
  test.use({ storageState: STATE("admin") });
  test("sem o aplicativo configurado: indisponível; retorno forjado: recusado", async ({ page, request }) => {
    await page.goto("/api/payments/mercadopago/connect");
    await expect(page).toHaveURL(/\/configuracoes\?mp=indisponivel/);
    await expect(page.getByText("A conexão com Mercado Pago ainda não foi ativada no IGREJAQUA.")).toBeVisible();
    // Retorno sem o cookie de quem iniciou (CSRF / código roubado): recusado sem tocar no banco.
    await page.goto("/api/payments/mercadopago/callback?code=TG-roubado-123&state=qualquer-coisa-123456");
    await expect(page).toHaveURL(/\/configuracoes\?mp=invalido/);
    await expect(page.getByText(/expirou ou foi iniciada por outra pessoa/)).toBeVisible();
    const anon = await request.get("/api/payments/mercadopago/connect", { maxRedirects: 0, headers: { cookie: "" } });
    expect([303, 307]).toContain(anon.status());
  });
});

test.describe("membro não mexe em pagamentos", () => {
  test.use({ storageState: STATE("member") });
  test("não vê a seção Contribuições nas configurações e não inicia conexão", async ({ page }) => {
    await page.goto("/configuracoes");
    await expect(page.locator("#contribuicoes")).toHaveCount(0);
    await page.goto("/api/payments/mercadopago/connect");
    await expect(page).toHaveURL(/\/configuracoes\?mp=sem-permissao/);
  });
});
