import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseDeliveryConfig } from "@/lib/notifications/config";
import { processDeliveries } from "@/lib/notifications/deliver";
import { createWebPushSender } from "@/lib/notifications/push";
import { createDeliveryStore } from "@/modules/notifications/delivery-store";

const NO_STORE = { "cache-control": "no-store" } as const;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Trabalhador da fila de e-mail/push. Chamado por agendador externo com `Authorization: Bearer $CRON_SECRET`. */
async function run(request: Request): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (secret === undefined || secret.length < 16) return NextResponse.json({ error: "Agendador não configurado." }, { status: 503, headers: NO_STORE });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });

  const config = parseDeliveryConfig(process.env);
  if (config.email === null && config.push === null) return NextResponse.json({ claimed: 0, sent: 0, failed: 0, skipped: 0, note: "nenhum canal configurado" }, { status: 200, headers: NO_STORE });
  try {
    const summary = await processDeliveries({ store: createDeliveryStore(), config, pushSender: config.push === null ? null : createWebPushSender(config.push) });
    return NextResponse.json(summary, { status: 200, headers: NO_STORE });
  } catch (cause) {
    console.error("delivery_run_failed", cause instanceof Error ? cause.message : "unknown");
    return NextResponse.json({ error: "Falha ao processar a fila." }, { status: 500, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
