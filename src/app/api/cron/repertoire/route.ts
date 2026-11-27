import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createDeepSeekClient } from "@/lib/ai/client";
import { parseAiConfig } from "@/lib/ai/config";
import { runRepertoireJob } from "@/lib/ai/repertoire";
import { createRepertoireStore } from "@/modules/repertoire/ai-store";

const NO_STORE = { "cache-control": "no-store" } as const;
export const maxDuration = 300;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Job diário de repertório por IA. Chamado por agendador externo (Vercel Cron, pg_cron + pg_net) com
 * `Authorization: Bearer $CRON_SECRET`. Gera só rascunhos; o setlist depende de aceite humano.
 */
async function run(request: Request): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (secret === undefined || secret.length < 16) return NextResponse.json({ error: "Agendador não configurado." }, { status: 503, headers: NO_STORE });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });

  const config = parseAiConfig(process.env);
  if (config === null) return NextResponse.json({ sessions: 0, note: "IA não configurada (DEEPSEEK_API_KEY/DEEPSEEK_MODEL)" }, { status: 200, headers: NO_STORE });
  try {
    const summary = await runRepertoireJob({ store: createRepertoireStore(), client: createDeepSeekClient(config) });
    return NextResponse.json(summary, { status: 200, headers: NO_STORE });
  } catch (cause) {
    console.error("repertoire_job_failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "Falha ao gerar repertórios." }, { status: 500, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
