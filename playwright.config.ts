import { defineConfig, devices } from "@playwright/test";

const PORT = 3150;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Em ambientes sem download do Chromium do Playwright, aponte para um Chrome instalado.
    ...(process.env["IQ_E2E_CHROME"] ? { launchOptions: { executablePath: process.env["IQ_E2E_CHROME"] } } : {}),
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testtesttesttesttest" },
  },
});
