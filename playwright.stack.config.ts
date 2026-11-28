import { defineConfig, devices } from "@playwright/test";

/** Passeio autenticado contra a pilha de teste ISOLADA (tools/e2e-stack). O app já deve estar rodando em :3160. */
const chrome = process.env["IQ_E2E_CHROME"];
const launch = chrome ? { launchOptions: { executablePath: chrome } } : {};
export default defineConfig({
  testDir: "tests/stack",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3160", locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure", ...launch },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /tour\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "tablet", testMatch: /tour\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "desktop", testMatch: /tour\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "convites", testMatch: /invite-links\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "biblioteca", testMatch: /library\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "importacao", testMatch: /song-import\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "menu-celular", testMatch: /menu\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
