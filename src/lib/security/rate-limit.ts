import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Hash do IP (nunca armazenamos IP puro — LGPD). */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

/**
 * Rate limit atômico no Postgres (ADR-0006). Em produção falha FECHADO (nega) se o serviço estiver indisponível.
 * Retorna true se a requisição pode prosseguir.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("rate_limit_hit", {
      p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(error.message);
    return data === true;
  } catch (cause) {
    console.error("rate_limit_unavailable", cause instanceof Error ? cause.message : "unknown");
    return process.env.NODE_ENV !== "production";
  }
}
