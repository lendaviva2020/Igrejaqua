import "server-only";
import { z } from "zod";
import { RepertoireContextSchema, type RepertoireStore } from "@/lib/ai/repertoire";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * ÚNICO ponto do repertório que usa service role (SECURITY §6, lista fechada): o job agendado não tem usuário.
 * Só chama três funções SQL restritas a service_role (ai_repertoire_due_sessions/context/record);
 * não lê nem grava tabelas diretamente. Nenhum dado pessoal sai daqui.
 */
export function createRepertoireStore(): RepertoireStore {
  const client = createSupabaseAdminClient();
  return {
    async dueSessions(days, limit) {
      const { data, error } = await client.rpc("ai_repertoire_due_sessions", { p_days: days, p_limit: limit });
      if (error) throw new Error(`Falha ao listar sessões do repertório: ${error.message}`);
      return z.array(z.object({ session_id: z.string().uuid(), church_id: z.string().uuid() })).parse(data).map((r) => ({ sessionId: r.session_id, churchId: r.church_id }));
    },
    async context(sessionId) {
      const { data, error } = await client.rpc("ai_repertoire_context", { p_session: sessionId });
      if (error) throw new Error(`Falha ao coletar o contexto do repertório: ${error.message}`);
      return data === null ? null : RepertoireContextSchema.parse(data);
    },
    async record(run) {
      const { data, error } = await client.rpc("ai_repertoire_record", {
        p_session: run.sessionId, p_prompt_version: run.promptVersion, p_input_digest: run.inputDigest, p_model: run.model ?? "",
        p_request_tokens: run.requestTokens, p_response_tokens: run.responseTokens, p_raw: run.raw, p_report: run.report, p_status: run.status,
      });
      if (error) throw new Error(`Falha ao registrar a sugestão de repertório: ${error.message}`);
      return z.string().uuid().parse(data);
    },
  };
}
