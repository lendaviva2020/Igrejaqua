import "server-only";
import { z } from "zod";
import { AI_LIMITS, type AiConfig } from "@/lib/ai/config";
import { createCircuitBreaker, type CircuitBreaker } from "@/lib/ai/circuit-breaker";

export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface ChatResult {
  readonly text: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface AiClient {
  complete(messages: readonly ChatMessage[]): Promise<ChatResult>;
}

/** Falha do provedor. A mensagem é segura para logs (sem chave, sem corpo da resposta). */
export class AiUnavailableError extends Error {
  constructor(readonly reason: "circuit_open" | "timeout" | "network" | "http" | "format" | "truncated" | "auth", message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }), finish_reason: z.string().nullable().optional() })).min(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative() }).optional(),
});

export interface DeepSeekDeps {
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly breaker?: CircuitBreaker;
  readonly random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Cliente da API de chat compatível com OpenAI (DeepSeek). Somente servidor.
 * Timeout por tentativa, retry com backoff exponencial + jitter e disjuntor. Nunca executa ferramentas.
 */
export function createDeepSeekClient(config: AiConfig, deps: DeepSeekDeps = {}): AiClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const breaker = deps.breaker ?? sharedBreaker;
  const random = deps.random ?? Math.random;

  async function attempt(messages: readonly ChatMessage[]): Promise<ChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_LIMITS.timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_tokens: AI_LIMITS.maxOutputTokens,
          response_format: { type: "json_object" },
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === "AbortError";
      throw new AiUnavailableError(aborted ? "timeout" : "network", aborted ? "Tempo limite excedido" : "Falha de rede ao chamar o provedor");
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401 || response.status === 403) throw new AiUnavailableError("auth", "Credencial do provedor recusada");
    if (!response.ok) throw new AiUnavailableError("http", `Provedor respondeu HTTP ${response.status}`);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AiUnavailableError("format", "Resposta do provedor não é JSON");
    }
    const parsed = completionSchema.safeParse(json);
    if (!parsed.success) throw new AiUnavailableError("format", "Formato de resposta inesperado");
    const choice = parsed.data.choices[0];
    if (choice === undefined) throw new AiUnavailableError("format", "Resposta sem escolhas");
    if (choice.finish_reason === "length") throw new AiUnavailableError("truncated", "Resposta truncada pelo limite de tokens");
    return {
      text: choice.message.content,
      model: parsed.data.model ?? config.model,
      promptTokens: parsed.data.usage?.prompt_tokens ?? 0,
      completionTokens: parsed.data.usage?.completion_tokens ?? 0,
    };
  }

  function isRetriable(error: AiUnavailableError, lastStatus: number | null): boolean {
    if (error.reason === "timeout" || error.reason === "network") return true;
    return error.reason === "http" && lastStatus !== null && RETRIABLE_STATUS.has(lastStatus);
  }

  return {
    async complete(messages: readonly ChatMessage[]): Promise<ChatResult> {
      if (!breaker.canRequest()) throw new AiUnavailableError("circuit_open", "Provedor temporariamente indisponível");
      let lastError: AiUnavailableError | null = null;
      for (let n = 0; n <= AI_LIMITS.maxRetries; n += 1) {
        try {
          const result = await attempt(messages);
          breaker.onSuccess();
          return result;
        } catch (cause) {
          const error = cause instanceof AiUnavailableError ? cause : new AiUnavailableError("network", "Falha inesperada");
          lastError = error;
          const status = error.reason === "http" ? Number.parseInt(/HTTP (\d+)/.exec(error.message)?.[1] ?? "", 10) || null : null;
          if (!isRetriable(error, status) || n === AI_LIMITS.maxRetries) break;
          await sleep(500 * 2 ** n + Math.floor(random() * 250));
        }
      }
      // Erros de formato/autenticação não indicam instabilidade do provedor: não abrem o disjuntor.
      if (lastError !== null && (lastError.reason === "timeout" || lastError.reason === "network" || lastError.reason === "http")) breaker.onFailure();
      throw lastError ?? new AiUnavailableError("network", "Falha inesperada");
    },
  };
}

const sharedBreaker: CircuitBreaker = createCircuitBreaker();
