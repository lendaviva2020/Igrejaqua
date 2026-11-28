import { expect, test } from "@playwright/test";
import { STATE } from "./helpers.ts";

/** Importação no repertório: colar cifra preenche o formulário; nada é salvo sem a pessoa confirmar. */
test.use({ storageState: STATE("admin") });

const PASTED = "Música Importada de Teste\nBanda de Teste\nTom: D\n\n[Intro] D  A\n\n[Primeira Parte]\nD          A\nLinha de teste um\nBm         G\nLinha de teste dois\n";

test("colar cifra → formulário preenchido → salvar abre a música", async ({ page }) => {
  await page.goto("/repertorio");
  await page.getByRole("button", { name: "Colar cifra" }).click();
  await page.getByLabel("Cifra copiada").fill(PASTED);
  await page.getByRole("button", { name: "Converter cifra" }).click();

  await expect(page.getByText("Cifra convertida")).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Música Importada de Teste");
  await expect(page.getByLabel("Autor/Intérprete (opcional)")).toHaveValue("Banda de Teste");
  await expect(page.getByLabel("Tom original")).toHaveValue("D");
  await expect(page.getByLabel("Cifra (ChordPro)")).toHaveValue(/\[D\]Linha de te\[A\]ste um/);

  await page.getByRole("button", { name: "Salvar música" }).click();
  await expect(page).toHaveURL(/\/repertorio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Música Importada de Teste");
});

test("link para endereço interno é recusado com mensagem clara (sem conexão)", async ({ page }) => {
  await page.goto("/repertorio");
  await page.getByLabel("Link da página da música").fill("https://169.254.169.254/latest/meta-data");
  await page.getByRole("button", { name: "Buscar música" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Esse endereço não pode ser acessado. Use o link público da página da música.");
  await page.getByLabel("Link da página da música").fill("http://exemplo.com.br/musica");
  await page.getByRole("button", { name: "Buscar música" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Use um link completo que comece com https://.");
});

test("link de referência salvo aparece como Ouvir no YouTube na página da música", async ({ page }) => {
  await page.goto("/repertorio");
  await page.getByLabel("Título").fill("Música com Vídeo de Teste");
  await page.getByLabel("Link de referência (opcional)").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByLabel("Cifra (ChordPro)").fill("[G]Linha de teste");
  await page.getByRole("button", { name: "Salvar música" }).click();
  await expect(page).toHaveURL(/\/repertorio\/[0-9a-f-]{36}$/);
  const ouvir = page.getByRole("link", { name: /Ouvir no YouTube/ });
  await expect(ouvir).toHaveAttribute("href", "https://youtu.be/dQw4w9WgXcQ");
  await expect(ouvir).toHaveAttribute("rel", "noopener noreferrer");
});

test("link de referência inseguro é recusado no formulário", async ({ page }) => {
  await page.goto("/repertorio");
  await page.getByLabel("Título").fill("Música Insegura");
  await page.getByLabel("Link de referência (opcional)").fill("http://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Salvar música" }).click();
  await expect(page.locator("main").getByText("Use um link seguro, começando com https://")).toBeVisible();
  await expect(page).toHaveURL(/\/repertorio$/);
});

test("Spotify: link de álbum é recusado com orientação; música salva mostra Ouvir no Spotify", async ({ page }) => {
  await page.goto("/repertorio");
  await page.getByLabel("Link da página da música").fill("https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4");
  await page.getByRole("button", { name: "Buscar música" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Esse link do Spotify não é de uma música. Abra a música e use Compartilhar → Copiar link da música.");

  await page.getByLabel("Título").fill("Música com Spotify de Teste");
  await page.getByLabel("Link de referência (opcional)").fill("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  await page.getByRole("button", { name: "Salvar música" }).click();
  await expect(page).toHaveURL(/\/repertorio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: /Ouvir no Spotify/ })).toHaveAttribute("href", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
});

test("Colar e converter lê a área de transferência; Procurar a cifra usa o título editado", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3160" });
  // O buscador externo não é acessado no teste: só conferimos o endereço que abriria.
  await context.route("https://www.google.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>busca</title>" }));
  await page.goto("/repertorio");
  await page.getByRole("button", { name: "Colar cifra" }).click();

  await page.evaluate(() => navigator.clipboard.writeText("Canção da Área de Transferência\nGrupo Teste\nTom: E\n\nE        B\nLinha de teste\n"));
  await page.getByRole("button", { name: "Colar e converter" }).click();
  await expect(page.getByLabel("Título")).toHaveValue("Canção da Área de Transferência");
  await expect(page.getByLabel("Tom original")).toHaveValue("E");
  await expect(page.getByLabel("Cifra (ChordPro)")).toHaveValue("[E]Linha de [B]teste");

  await page.getByLabel("Título").fill("Título Editado à Mão");
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: /Procurar a cifra/ }).click();
  const popup = await popupPromise;
  expect(decodeURIComponent(popup.url())).toContain("q=cifra Título Editado à Mão Grupo Teste");
  await popup.close();
});
