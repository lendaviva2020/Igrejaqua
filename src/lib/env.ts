import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DEEPSEEK_API_KEY: z.string().min(10).optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  /**
   * Mercado Pago: aplicativo do IGREJAQUA para cada igreja conectar a PRÓPRIA conta (OAuth). Opcionais —
   * sem eles só o Pix pela chave da igreja funciona. Não existe conta "da plataforma" recebendo dinheiro.
   */
  MERCADOPAGO_CLIENT_ID: z.string().regex(/^\d{5,25}$/).optional(),
  MERCADOPAGO_CLIENT_SECRET: z.string().min(16).optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(8).optional(),
  /** 32 bytes em base64 (openssl rand -base64 32): cifra os tokens das igrejas no banco. */
  MERCADOPAGO_TOKEN_KEY: z.string().min(40).optional(),
});

/** Variáveis públicas (seguro em qualquer ambiente). Falha cedo e com mensagem clara. */
export function publicEnv(): z.infer<typeof publicSchema> {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  });
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente públicas inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

/** Variáveis de servidor. Só importe a partir de código que roda no servidor. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") throw new Error("serverEnv() chamado no navegador");
  // Linhas vazias do .env (ex.: `CRON_SECRET=`) chegam como "" e significam "não configurado".
  const env = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = serverSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente de servidor inválidas: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}
