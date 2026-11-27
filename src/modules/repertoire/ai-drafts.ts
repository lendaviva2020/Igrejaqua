import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Issue = z.object({ code: z.string(), message: z.string() });
const Report = z.object({
  accepted: z.array(z.object({ song_version_id: z.string().uuid(), position: z.number(), title: z.string(), artist: z.string().nullable(), key: z.string(), reason: z.string().nullable() })).default([]),
  new_songs: z.array(z.object({ title: z.string(), artist: z.string().nullable(), reason: z.string().nullable() })).default([]),
  violations: z.array(Issue).default([]),
  warnings: z.array(Issue).default([]),
  theme: z.object({ title: z.string(), scripture_ref: z.string().nullable() }).nullable().default(null),
});
const Row = z.object({ id: z.string().uuid(), target_session_id: z.string().uuid(), status: z.enum(["validated", "validation_failed"]), created_at: z.string(), validation_report: z.unknown() });

export interface RepertoireDraft {
  readonly runId: string;
  readonly sessionId: string;
  readonly status: "validated" | "validation_failed";
  readonly createdAt: string;
  readonly songs: z.infer<typeof Report>["accepted"];
  readonly newSongs: z.infer<typeof Report>["new_songs"];
  readonly violations: z.infer<typeof Report>["violations"];
  readonly warnings: z.infer<typeof Report>["warnings"];
  readonly theme: z.infer<typeof Report>["theme"];
}

/** Rascunhos de repertório da IA ainda não decididos (o mais recente por sessão). RLS: manage_repertoire/manage_schedule. */
export async function listRepertoireDrafts(churchId: string, sessionIds: readonly string[]): Promise<readonly RepertoireDraft[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_generation_runs")
    .select("id, target_session_id, status, created_at, validation_report")
    .eq("church_id", churchId)
    .eq("kind", "repertoire")
    .in("status", ["validated", "validation_failed"])
    .in("target_session_id", [...sessionIds])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Falha ao carregar sugestões de repertório: ${error.message}`);
  const latest = new Map<string, RepertoireDraft>();
  for (const row of z.array(Row).parse(data)) {
    if (latest.has(row.target_session_id)) continue;
    const report = Report.safeParse(row.validation_report);
    if (!report.success) continue;
    latest.set(row.target_session_id, {
      runId: row.id, sessionId: row.target_session_id, status: row.status, createdAt: row.created_at,
      songs: report.data.accepted, newSongs: report.data.new_songs, violations: report.data.violations, warnings: report.data.warnings, theme: report.data.theme,
    });
  }
  return [...latest.values()];
}
