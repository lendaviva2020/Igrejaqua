import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAiConfig } from "@/lib/ai/config";
import { DSR_KINDS } from "./schemas";

const Profile = z.object({ full_name: z.string(), display_name: z.string().nullable(), phone: z.string().nullable() });
const Church = z.object({ name: z.string(), legal_name: z.string().nullable(), document_number: z.string().nullable(), timezone: z.string() });
const Dsr = z.object({ id: z.string().uuid(), user_id: z.string().uuid(), kind: z.enum(DSR_KINDS), status: z.enum(["open", "in_progress", "done", "rejected"]), details: z.string().nullable(), due_at: z.string(), created_at: z.string() });
const Dir = z.object({ user_id: z.string().uuid(), display_name: z.string() });

export type ProfileData = z.infer<typeof Profile>;
export type ChurchData = z.infer<typeof Church>;
export interface DsrItem { readonly id: string; readonly kind: (typeof DSR_KINDS)[number]; readonly status: "open" | "in_progress" | "done" | "rejected"; readonly details: string | null; readonly dueAt: string; readonly createdAt: string; readonly requester: string; readonly mine: boolean }

export async function getMyProfile(userId: string): Promise<ProfileData> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("full_name, display_name, phone").eq("id", userId).single();
  if (error) throw new Error(`Falha ao carregar perfil: ${error.message}`);
  return Profile.parse(data);
}

export async function getChurchData(churchId: string): Promise<ChurchData> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("churches").select("name, legal_name, document_number, timezone").eq("id", churchId).single();
  if (error) throw new Error(`Falha ao carregar igreja: ${error.message}`);
  return Church.parse(data);
}

/** RLS: titular vê os seus; administração vê todos da igreja. */
export async function listDataRequests(churchId: string, currentUserId: string): Promise<readonly DsrItem[]> {
  const supabase = await createSupabaseServerClient();
  const [reqs, dir] = await Promise.all([
    supabase.from("data_subject_requests").select("id, user_id, kind, status, details, due_at, created_at").eq("church_id", churchId).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("church_directory", { p_church: churchId }),
  ]);
  if (reqs.error) throw new Error(`Falha ao listar pedidos: ${reqs.error.message}`);
  const names = new Map(dir.error ? [] : z.array(Dir).parse(dir.data).map((d) => [d.user_id, d.display_name]));
  return z.array(Dsr).parse(reqs.data).map((r) => ({ id: r.id, kind: r.kind, status: r.status, details: r.details, dueAt: r.due_at, createdAt: r.created_at, requester: names.get(r.user_id) ?? "Pessoa", mine: r.user_id === currentUserId }));
}

export interface AiState {
  /** A administração ativou a IA (com consentimento registrado). */
  readonly enabled: boolean;
  /** O servidor tem chave e modelo configurados; sem isso nenhuma sugestão é possível. */
  readonly configured: boolean;
}

export async function getAiState(churchId: string): Promise<AiState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_settings").select("ai_enabled, ai_data_sharing_consent_at").eq("church_id", churchId).maybeSingle();
  if (error) throw new Error(`Falha ao ler configuração de IA: ${error.message}`);
  const row = z.object({ ai_enabled: z.boolean(), ai_data_sharing_consent_at: z.string().nullable() }).nullable().parse(data);
  return { enabled: row !== null && row.ai_enabled && row.ai_data_sharing_consent_at !== null, configured: parseAiConfig(process.env) !== null };
}
