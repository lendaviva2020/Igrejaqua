import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_LIMITS } from "@/lib/ai/config";
import { isJsonRequest, jsonResult } from "@/lib/ai/http";
import { runScheduleSuggestion } from "@/lib/ai/orchestrator";
import { fail } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BodySchema = z
  .object({
    sessionId: z.string().uuid(),
    slots: z.array(z.object({ function: z.string().trim().min(1).max(40), count: z.number().int().min(1).max(AI_LIMITS.maxSlotCount) }).strict()).min(1).max(AI_LIMITS.maxSlots),
  })
  .strict();

/** Sugestão consultiva de escala: gera, valida e registra. Não cria escala nem publica. */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonResult(fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente."));
  if (!isJsonRequest(request)) return jsonResult(fail("VALIDATION", "Envie o corpo como application/json."));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResult(fail("VALIDATION", "Corpo da requisição inválido."));
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonResult(fail("VALIDATION", "Dados inválidos para a sugestão."));

  if (!(await allow(`ai:user:${auth.user.id}`, AI_LIMITS.perUserPerHour, 3_600))) {
    return jsonResult(fail("RATE_LIMITED", "Muitas sugestões em pouco tempo. Aguarde alguns minutos."));
  }
  return jsonResult(await runScheduleSuggestion({ userId: auth.user.id, sessionId: parsed.data.sessionId, slots: parsed.data.slots }));
}
