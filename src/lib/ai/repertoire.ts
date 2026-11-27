import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AiUnavailableError, type AiClient } from "@/lib/ai/client";
import { REPERTOIRE_LIMITS } from "@/lib/ai/config";
import { buildRepertoirePrompt, REPERTOIRE_PROMPT_VERSION, type RepertoirePayload } from "@/lib/ai/prompts/repertoire";
import { parseAiRepertoireOutput } from "@/lib/ai/schemas/repertoire";
import { validateRepertoire, type EligibleSong } from "@/lib/ai/validators/repertoire";

/** Contexto devolvido por `ai_repertoire_context` (só dados de música e da sessão; nenhuma pessoa). */
export const RepertoireContextSchema = z.object({
  session_id: z.string().uuid(),
  church_id: z.string().uuid(),
  session_name: z.string(),
  event_title: z.string(),
  event_kind: z.string(),
  starts_local: z.string(),
  duration_min: z.number().int(),
  theme: z.object({ title: z.string(), scripture_ref: z.string().nullable() }).nullable(),
  songs: z.array(z.object({
    version_id: z.string().uuid(),
    title: z.string(),
    artist: z.string().nullable(),
    key: z.string(),
    bpm: z.number().int().nullable(),
    duration_s: z.number().int().nullable(),
    tags: z.array(z.string()),
    last_used_days: z.number().int().nullable(),
  })),
});
export type RepertoireContext = z.infer<typeof RepertoireContextSchema>;

export interface RepertoireRecord {
  readonly sessionId: string;
  readonly promptVersion: string;
  readonly inputDigest: string;
  readonly model: string | null;
  readonly requestTokens: number | null;
  readonly responseTokens: number | null;
  readonly raw: unknown;
  readonly report: unknown;
  readonly status: "validated" | "validation_failed" | "error";
}

/** Acesso a dados do job. A implementação real usa service role e SÓ funções SQL (modules/repertoire/ai-store.ts). */
export interface RepertoireStore {
  dueSessions(days: number, limit: number): Promise<readonly { sessionId: string; churchId: string }[]>;
  context(sessionId: string): Promise<RepertoireContext | null>;
  record(run: RepertoireRecord): Promise<string>;
}

export interface RepertoireJobSummary { sessions: number; validated: number; failed: number; skipped: number; errors: number }

/** Monta o payload com tokens efêmeros; tags e textos são cortados (dado de entrada, nunca instrução). */
export function buildRepertoirePayload(ctx: RepertoireContext): { payload: RepertoirePayload; eligible: EligibleSong[] } {
  const songs = ctx.songs.slice(0, REPERTOIRE_LIMITS.maxEligibleSongs);
  const eligible: EligibleSong[] = songs.map((s, i) => ({
    token: `S${String(i + 1).padStart(2, "0")}`, versionId: s.version_id, title: s.title, artist: s.artist, key: s.key, lastUsedDays: s.last_used_days,
  }));
  const payload: RepertoirePayload = {
    session: { name: ctx.session_name.slice(0, 120), event: ctx.event_title.slice(0, 200), kind: ctx.event_kind, starts_local: ctx.starts_local, duration_min: ctx.duration_min },
    theme: ctx.theme === null ? null : { title: ctx.theme.title.slice(0, 200), scripture_ref: ctx.theme.scripture_ref?.slice(0, 120) ?? null },
    songs: songs.map((s, i) => ({
      token: eligible[i]!.token, title: s.title.slice(0, 200), artist: s.artist?.slice(0, 200) ?? null, key: s.key, bpm: s.bpm,
      duration_s: s.duration_s, tags: s.tags.slice(0, 8).map((t) => t.slice(0, 40)), last_used_days: s.last_used_days,
    })),
    target: { min_songs: REPERTOIRE_LIMITS.minSongs, max_songs: REPERTOIRE_LIMITS.maxSongs, max_new_songs: REPERTOIRE_LIMITS.maxNewSongs },
  };
  return { payload, eligible };
}

/**
 * Job diário: para cada culto/ensaio dos próximos dias sem repertório, gera um RASCUNHO (coleta → IA → validação
 * determinística → registro). Nada vira setlist sem aceite humano (ai_accept_repertoire_run).
 */
export async function runRepertoireJob(deps: { store: RepertoireStore; client: AiClient }): Promise<RepertoireJobSummary> {
  const summary: RepertoireJobSummary = { sessions: 0, validated: 0, failed: 0, skipped: 0, errors: 0 };
  const due = await deps.store.dueSessions(REPERTOIRE_LIMITS.daysAhead, REPERTOIRE_LIMITS.sessionsPerRun);
  for (const { sessionId } of due) {
    summary.sessions += 1;
    const ctx = await deps.store.context(sessionId);
    if (ctx === null || ctx.songs.length < REPERTOIRE_LIMITS.minSongs) { summary.skipped += 1; continue; }
    const { payload, eligible } = buildRepertoirePayload(ctx);
    const inputDigest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const base = { sessionId, promptVersion: REPERTOIRE_PROMPT_VERSION, inputDigest };
    try {
      const result = await deps.client.complete(buildRepertoirePrompt(payload));
      const parsed = parseAiRepertoireOutput(result.text);
      const tokens = { model: result.model, requestTokens: result.promptTokens, responseTokens: result.completionTokens };
      if (!parsed.ok) {
        await deps.store.record({ ...base, ...tokens, raw: { text: result.text.slice(0, 20_000) }, report: { violations: [{ code: "formato", message: parsed.reason.slice(0, 300) }] }, status: "validation_failed" });
        summary.failed += 1;
        continue;
      }
      const v = validateRepertoire(parsed.data, eligible);
      await deps.store.record({
        ...base, ...tokens, raw: parsed.data,
        report: { accepted: v.accepted, new_songs: v.newSongs, violations: v.violations, warnings: v.warnings, theme: payload.theme },
        status: v.status,
      });
      if (v.status === "validated") summary.validated += 1; else summary.failed += 1;
    } catch (cause) {
      if (!(cause instanceof AiUnavailableError)) throw cause;
      await deps.store.record({ ...base, model: null, requestTokens: null, responseTokens: null, raw: null, report: { error: cause.reason }, status: "error" });
      summary.errors += 1;
      if (cause.reason === "circuit_open" || cause.reason === "auth") break;
    }
  }
  return summary;
}
