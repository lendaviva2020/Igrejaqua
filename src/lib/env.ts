import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DEEPSEEK_API_KEY: z.string().min(10).optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

/** Variáveis públicas (seguro em qualquer ambiente). Falha cedo e com mensagem clara. */
export function publicEnv(): z.infer<typeof publicSchema> {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    NEXT_PUBLIC_SITE_URL: process.env["NEXT_PUBLIC_SITE_URL"],
  });
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente públicas inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

/** Variáveis de servidor. Só importe a partir de código que roda no servidor. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") throw new Error("serverEnv() chamado no navegador");
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente de servidor inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}
