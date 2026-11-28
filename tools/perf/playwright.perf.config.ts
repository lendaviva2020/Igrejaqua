import { defineConfig, devices } from "@playwright/test";

/**
 * Benchmark de navegação contra a pilha isolada (docs/E2E_STACK.md) com o proxy de latência
 * (tools/perf/latency-proxy.ts). O app (next start) já deve estar rodando em :3160 apontando para o proxy.
 */
const chrome = process.env["IQ_E2E_CHROME"];
const launch = chrome ? { launchOptions: { executablePath: chrome } } : {};
export default defineConfig({
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3160", locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "off", ...launch },
  projects: [
    { name: "setup", testDir: "../../tests/stack", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "bench", testDir: ".", testMatch: /navigation\.bench\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
  ],
});
