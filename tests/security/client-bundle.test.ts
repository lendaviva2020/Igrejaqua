import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const staticDir = join(process.cwd(), ".next", "static");

describe.skipIf(!existsSync(staticDir))("bundle do navegador não contém segredos (SECURITY §6)", () => {
  const files = existsSync(staticDir) ? walk(staticDir).filter((f) => /\.(js|css|map)$/.test(f)) : [];
  const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "DEEPSEEK_API_KEY", "service_role", "CRON_SECRET", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "MERCADOPAGO_CLIENT_SECRET", "MERCADOPAGO_TOKEN_KEY", "mp-accounts-store", "access_token_enc", "provider-writes", "createSupabaseAdminClient", "rate_limit_hit"];
  it.each(forbidden)("nenhum chunk contém %s", (needle) => {
    const leaks = files.filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(leaks).toEqual([]);
  });
  it("há chunks para varrer", () => expect(files.length).toBeGreaterThan(0));
});
