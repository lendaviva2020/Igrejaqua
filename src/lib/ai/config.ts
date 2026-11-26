import { z } from "zod";

/** Versões de prompt registradas em ai_generation_runs.prompt_version (AI_ENGINE §2). */
export const PROMPT_VERSIONS = { schedule: "schedule-v1" } as const;

/** Limites de custo, tamanho e abuso (AI_ENGINE §7). */
export const AI_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 2,
  maxOutputTokens: 1_500,
  maxCandidates: 60,
  maxSlots: 12,
  maxSlotCount: 10,
  perUserPerHour: 10,
  perChurchPerDay: 60,
} as const;

export interface AiConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

const envSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(10),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().min(1),
});

/**
 * Lê a configuração do provedor. Retorna null quando incompleta: o produto funciona 100% sem IA.
 * O nome do modelo vem do ambiente (não verificado em Gate: AI_ENGINE §8).
 */
export function parseAiConfig(env: Readonly<Record<string, string | undefined>>): AiConfig | null {
  const parsed = envSchema.safeParse({
    DEEPSEEK_API_KEY: env["DEEPSEEK_API_KEY"] || undefined,
    DEEPSEEK_BASE_URL: env["DEEPSEEK_BASE_URL"] || undefined,
    DEEPSEEK_MODEL: env["DEEPSEEK_MODEL"] || undefined,
  });
  if (!parsed.success) return null;
  return { apiKey: parsed.data.DEEPSEEK_API_KEY, baseUrl: parsed.data.DEEPSEEK_BASE_URL.replace(/\/+$/, ""), model: parsed.data.DEEPSEEK_MODEL };
}
