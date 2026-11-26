import { NextResponse } from "next/server";
import { z } from "zod";
import { isJsonRequest, jsonResult } from "@/lib/ai/http";
import { acceptScheduleRun, discardRun } from "@/lib/ai/orchestrator";
import { fail } from "@/lib/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BodySchema = z.object({ action: z.enum(["accept", "discard"]) }).strict();

/** Revisão humana: aceitar cria RASCUNHO de escala; descartar encerra a execução. A permissão é revalidada no banco. */
export async function POST(request: Request, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonResult(fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente."));
  if (!isJsonRequest(request)) return jsonResult(fail("VALIDATION", "Envie o corpo como application/json."));

  const { runId } = await context.params;
  if (!z.string().uuid().safeParse(runId).success) return jsonResult(fail("NOT_FOUND", "Execução não encontrada."));
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResult(fail("VALIDATION", "Corpo da requisição inválido."));
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonResult(fail("VALIDATION", "Ação inválida."));
  if (parsed.data.action === "accept") return jsonResult(await acceptScheduleRun(runId));
  return jsonResult(await discardRun(runId));
}
