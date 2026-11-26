import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", ".claude/**", "next-env.d.ts", "coverage/**"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/lib/supabase/admin"], message: "Service role só em usos permitidos (SECURITY §6). Veja a lista fechada." },
        ],
      }],
    },
  },
  {
    // Usos permitidos do service role (lista fechada)
    files: ["src/lib/security/rate-limit.ts", "src/lib/supabase/admin.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);
