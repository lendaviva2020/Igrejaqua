import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AiUnavailableError, createDeepSeekClient, type AiClient } from "@/lib/ai/client";
import { AI_LIMITS, PROMPT_VERSIONS, parseAiConfig } from "@/lib/ai/config";
import { collectScheduleFacts } from "@/lib/ai/collectors/schedule";
import { buildSchedulePrompt } from "@/lib/ai/prompts/schedule";
import { createPseudonymizer } from "@/lib/ai/pseudonymize";
import { buildContext, buildPayload, resolveProposal, type Slot } from "@/lib/ai/schedule-context";
import { parseAiScheduleOutput } from "@/lib/ai/schemas/schedule";
import { validateSchedule, type Violation } from "@/lib/ai/validators/schedule";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, fromPostgrestError, ok, type Result } from "@/lib/result";

export interface SuggestedAssignment {
  readonly ministryMembershipId: string;
  readonly personName: string;
  readonly function: string;
  readonly rationale: string | null;
  /** Escalas na função dentro da janela de rotação (calculado em código, não pela IA). */
  readonly recentCount: number;
}

export interface ScheduleSuggestion {
  readonly runId: string;
  /** `validated` pode virar rascunho; `validation_failed` serve só para revisão. */
  readonly status: "validated" | "validation_failed";
  readonly assignments: readonly SuggestedAssignment[];
  readonly violations: readonly Violation[];
}

export interface OrchestratorDeps {
  readonly client?: AiClient;
  readonly now?: () => number;
}

const RpcUuid = z.string().uuid();

/**
 * Pipeline (AI_ENGINE §1): coleta → geração → validação determinística → registro. A revisão humana e o rascunho
 * acontecem depois, em `acceptScheduleRun`. Nada aqui publica; o produto funciona sem IA.
 */
export async function runScheduleSuggestion(
  input: { readonly userId: string; readonly sessionId: string; readonly slots: readonly Slot[] },
  deps: OrchestratorDeps = {},
): Promise<Result<ScheduleSuggestion>> {
  const config = parseAiConfig(process.env);
  const client = deps.client ?? (config === null ? null : createDeepSeekClient(config));
  if (client === null) return fail("AI_UNAVAILABLE", "O recurso de IA não está configurado neste ambiente.");
  const now = deps.now?.() ?? Date.now();

  const collected = await collectScheduleFacts(input.sessionId, input.slots, now);
  if (collected.kind === "not_found") return fail("NOT_FOUND", "Sessão não encontrada.");
  if (collected.kind === "no_ministry") return fail("RULE_VIOLATION", "Defina o ministério responsável pela sessão antes de pedir sugestão.");
  if (collected.kind === "ai_disabled") return fail("FORBIDDEN", "A IA está desativada para esta igreja.");
  if (collected.kind === "failed") {
    console.error("ai_collect_failed", collected.message);
    return fail("INTERNAL", "Não foi possível coletar os dados da escala.");
  }
  const { facts } = collected;

  const context = buildContext(facts);
  if (context.slots.length === 0) return fail("VALIDATION", "Informe ao menos uma função válida.");
  if (context.candidates.length === 0) return fail("RULE_VIOLATION", "Nenhum integrante do ministério atua nas funções pedidas.");

  if (!(await allow(`ai:church:${facts.churchId}`, AI_LIMITS.perChurchPerDay, 86_400))) {
    return fail("RATE_LIMITED", "Limite diário de sugestões desta igreja atingido.");
  }

  const pseudonymizer = createPseudonymizer();
  const payload = buildPayload(context, facts.policy, pseudonymizer);
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const messages = buildSchedulePrompt(payload);

  const supabase = await createSupabaseServerClient();
  const begin = await supabase.rpc("ai_begin_schedule_run", { p_session: input.sessionId, p_prompt_version: PROMPT_VERSIONS.schedule, p_input_digest: digest });
  if (begin.error) {
    if (begin.error.code === "55000") return fail("FORBIDDEN", "A IA está desativada para esta igreja.");
    return fromPostgrestError(begin.error);
  }
  const runId = RpcUuid.parse(begin.data);

  const finish = async (status: "validated" | "validation_failed" | "error", model: string | null, tokens: { prompt: number; completion: number }, raw: unknown, report: unknown): Promise<void> => {
    const { error } = await supabase.rpc("ai_finish_run", {
      p_run: runId, p_status: status, p_model: model ?? "", p_request_tokens: tokens.prompt, p_response_tokens: tokens.completion, p_raw: raw, p_report: report,
    });
    if (error) console.error("ai_finish_failed", error.code);
  };

  let completion;
  try {
    completion = await client.complete(messages);
  } catch (cause) {
    const reason = cause instanceof AiUnavailableError ? cause.reason : "network";
    await finish("error", null, { prompt: 0, completion: 0 }, { error: reason }, null);
    return fail("AI_UNAVAILABLE", "O serviço de IA está indisponível agora. Monte a escala manualmente ou tente de novo em instantes.");
  }
  const tokens = { prompt: completion.promptTokens, completion: completion.completionTokens };

  const parsed = parseAiScheduleOutput(completion.text);
  if (!parsed.ok) {
    await finish("error", completion.model, tokens, { error: "format", reason: parsed.reason.slice(0, 300) }, null);
    return fail("AI_UNAVAILABLE", "A IA devolveu uma resposta fora do formato esperado. Tente novamente.");
  }

  const resolved = resolveProposal(parsed.data, pseudonymizer, context.slots);
  const report = validateSchedule({ session: facts.session, proposal: resolved.proposal, candidates: context.candidates, existing: context.existing, policy: facts.policy });
  const violations: readonly Violation[] = [...resolved.violations, ...report.violations];
  const blocking = violations.some((v) => v.severity === "error");
  const status = blocking || report.accepted.length === 0 ? "validation_failed" : "validated";

  await finish(status, completion.model, tokens, { assignments: parsed.data.assignments }, {
    ok: !blocking,
    accepted: report.accepted.map((a) => ({ ministry_membership_id: a.ministryMembershipId, function: a.function })),
    violations: violations.map((v) => ({ code: v.code, severity: v.severity, ministry_membership_id: v.ministryMembershipId, function: v.function, message: v.message })),
  });

  const byId = new Map(context.candidates.map((c) => [c.ministryMembershipId, c] as const));
  return ok({
    runId,
    status,
    violations,
    assignments: report.accepted.map((a) => ({
      ministryMembershipId: a.ministryMembershipId,
      personName: context.displayNames.get(a.ministryMembershipId) ?? "Membro",
      function: a.function,
      rationale: resolved.rationale.get(`${a.ministryMembershipId}|${a.function.trim().toLocaleLowerCase("pt-BR")}`) ?? null,
      recentCount: byId.get(a.ministryMembershipId)?.recentByFunction[a.function] ?? 0,
    })),
  });
}

/** Aceitar = criar rascunho (event_lineup draft, source='ai'). Publicar continua exigindo publish_schedule. */
export async function acceptScheduleRun(runId: string): Promise<Result<{ created: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("ai_accept_schedule_run", { p_run: runId });
  if (error) {
    if (error.code === "55000") return fail("FORBIDDEN", "A IA está desativada para esta igreja.");
    return fromPostgrestError(error);
  }
  return ok({ created: z.number().int().parse(data) });
}

export async function discardRun(runId: string): Promise<Result<{ discarded: true }>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ai_discard_run", { p_run: runId });
  if (error) return fromPostgrestError(error);
  return ok({ discarded: true });
}
