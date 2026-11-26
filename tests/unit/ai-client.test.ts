import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCircuitBreaker } from "@/lib/ai/circuit-breaker";
import { AiUnavailableError, createDeepSeekClient } from "@/lib/ai/client";
import { parseAiConfig } from "@/lib/ai/config";

const config = { apiKey: "chave-de-teste-123", baseUrl: "https://api.exemplo.test", model: "modelo-x" };
const messages = [{ role: "system", content: "s" }, { role: "user", content: "u" }] as const;
const okBody = (content = '{"assignments":[]}', finish = "stop") => ({ model: "modelo-x", choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 12, completion_tokens: 7 } });
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const deps = (fetchImpl: typeof fetch) => ({ fetchImpl, sleep: async () => undefined, random: () => 0, breaker: createCircuitBreaker({ failureThreshold: 3, openMs: 1000, now: () => 0 }) });

describe("parseAiConfig", () => {
  it("retorna null sem chave ou sem modelo (produto funciona sem IA)", () => {
    expect(parseAiConfig({})).toBeNull();
    expect(parseAiConfig({ DEEPSEEK_API_KEY: "abcdefghij" })).toBeNull();
    expect(parseAiConfig({ DEEPSEEK_MODEL: "m" })).toBeNull();
  });
  it("normaliza a URL-base e aplica o padrão", () => {
    expect(parseAiConfig({ DEEPSEEK_API_KEY: "abcdefghij", DEEPSEEK_MODEL: "m", DEEPSEEK_BASE_URL: "https://x.test///" })?.baseUrl).toBe("https://x.test");
    expect(parseAiConfig({ DEEPSEEK_API_KEY: "abcdefghij", DEEPSEEK_MODEL: "m" })?.baseUrl).toBe("https://api.deepseek.com");
  });
});

describe("createDeepSeekClient", () => {
  it("envia chave só no cabeçalho e pede JSON sem streaming", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(okBody()));
    const result = await createDeepSeekClient(config, deps(fetchImpl)).complete(messages);
    expect(result).toEqual({ text: '{"assignments":[]}', model: "modelo-x", promptTokens: 12, completionTokens: 7 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.exemplo.test/chat/completions");
    expect((init?.headers as Record<string, string>)["authorization"]).toBe("Bearer chave-de-teste-123");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body["stream"]).toBe(false);
    expect(body["response_format"]).toEqual({ type: "json_object" });
    expect(String(init?.body)).not.toContain("chave-de-teste-123");
  });
  it("repete em 503 e acaba tendo sucesso", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(json(okBody()));
    const result = await createDeepSeekClient(config, deps(fetchImpl as unknown as typeof fetch)).complete(messages);
    expect(result.text).toBe('{"assignments":[]}');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("esgota as tentativas e falha com erro seguro", async () => {
    const fetchImpl = vi.fn(async () => json({ detalhe: "segredo" }, 500));
    const error = await createDeepSeekClient(config, deps(fetchImpl as unknown as typeof fetch)).complete(messages).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as AiUnavailableError).message).not.toContain("segredo");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("não repete em 400 nem em 401", async () => {
    const f400 = vi.fn(async () => json({}, 400));
    await expect(createDeepSeekClient(config, deps(f400 as unknown as typeof fetch)).complete(messages)).rejects.toMatchObject({ reason: "http" });
    expect(f400).toHaveBeenCalledTimes(1);
    const f401 = vi.fn(async () => json({}, 401));
    await expect(createDeepSeekClient(config, deps(f401 as unknown as typeof fetch)).complete(messages)).rejects.toMatchObject({ reason: "auth" });
    expect(f401).toHaveBeenCalledTimes(1);
  });
  it("rejeita resposta truncada e formato inesperado", async () => {
    await expect(createDeepSeekClient(config, deps((async () => json(okBody("{", "length"))) as unknown as typeof fetch)).complete(messages)).rejects.toMatchObject({ reason: "truncated" });
    await expect(createDeepSeekClient(config, deps((async () => json({ choices: [] })) as unknown as typeof fetch)).complete(messages)).rejects.toMatchObject({ reason: "format" });
  });
  it("trata falha de rede como indisponível", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(createDeepSeekClient(config, deps(fetchImpl as unknown as typeof fetch)).complete(messages)).rejects.toMatchObject({ reason: "network" });
  });
  it("abre o disjuntor após falhas seguidas e recusa sem chamar a rede", async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    const d = deps(fetchImpl as unknown as typeof fetch);
    const client = createDeepSeekClient(config, d);
    await expect(client.complete(messages)).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(client.complete(messages)).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(client.complete(messages)).rejects.toBeInstanceOf(AiUnavailableError);
    const calls = fetchImpl.mock.calls.length;
    await expect(client.complete(messages)).rejects.toMatchObject({ reason: "circuit_open" });
    expect(fetchImpl.mock.calls.length).toBe(calls);
  });
});

describe("createCircuitBreaker", () => {
  it("reabre para uma tentativa após o prazo e fecha com sucesso", () => {
    let t = 0;
    const b = createCircuitBreaker({ failureThreshold: 2, openMs: 100, now: () => t });
    b.onFailure(); b.onFailure();
    expect(b.canRequest()).toBe(false);
    t = 150;
    expect(b.canRequest()).toBe(true);
    b.onFailure();
    expect(b.canRequest()).toBe(false);
    t = 400;
    expect(b.canRequest()).toBe(true);
    b.onSuccess();
    b.onFailure();
    expect(b.canRequest()).toBe(true);
  });
});
