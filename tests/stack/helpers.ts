import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { totpCode } from "../../tools/e2e-stack/totp.ts";

export const PASSWORD = "SenhaDeTeste2026!";
export const USERS = { admin: "admin@teste.local", leader: "lider@teste.local", member: "membro@teste.local" } as const;
export const STATE = (who: keyof typeof USERS): string => `.stack/${who}.json`;
const DB_URL = process.env["IQ_DB_URL"] ?? "postgres://pgtest@/iq_e2e?host=/tmp&port=54329";

export async function dbValue(sql: string): Promise<string> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const r = await client.query<{ v: string }>(sql);
    return r.rows[0]?.v ?? "";
  } finally {
    await client.end();
  }
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const SECRET_FILE = ".stack/admin-totp-secret.txt";

/** Administrador: cadastra o autenticador (1º acesso, obrigatório) ou responde ao desafio (acessos seguintes), sempre com TOTP real. */
export async function completeAdminMfa(page: Page): Promise<void> {
  await page.waitForURL(/\/mfa/);
  if (/\/mfa\/configurar/.test(page.url())) {
    await page.getByRole("button", { name: "Configurar" }).click();
    const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    mkdirSync(".stack", { recursive: true });
    writeFileSync(SECRET_FILE, secret);
    await page.getByLabel("Código de 6 números").fill(totpCode(secret));
    await page.getByRole("button", { name: "Ativar" }).click();
  } else {
    expect(existsSync(SECRET_FILE), "chave TOTP do administrador não encontrada; recrie a pilha (tools/e2e-stack/start.sh)").toBe(true);
    await page.locator("#code").fill(totpCode(readFileSync(SECRET_FILE, "utf8").trim()));
    await page.locator("form button[type=submit]").click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}
