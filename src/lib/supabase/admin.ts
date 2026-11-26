import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente com service role: IGNORA RLS. Usos permitidos (SECURITY §6): jobs de retenção LGPD,
 * gravação de ai_generation_runs e rate limiting. Cada chamador deve registrar auditoria.
 * Nunca importar em componentes ou em código que o navegador possa carregar.
 */
export function createSupabaseAdminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
