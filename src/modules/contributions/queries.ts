import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({
  id: z.string().uuid(), membership_id: z.string().uuid(), purpose: z.enum(["oferta", "dizimo", "missoes", "outro"]), amount_cents: z.number(),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "expired", "refunded"]), qr_code: z.string().nullable(), expires_at: z.string().nullable(), paid_at: z.string().nullable(), created_at: z.string(),
  provider: z.enum(["mercadopago", "pix_key"]), pix_txid: z.string().nullable(),
});
export type ChargeItem = z.infer<typeof Row>;
const Dir = z.object({ membership_id: z.string().uuid(), display_name: z.string() });

/** RLS: membro vê só as próprias; administração vê todas da igreja. */
export async function listCharges(churchId: string, limit = 50): Promise<readonly ChargeItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("id, membership_id, purpose, amount_cents, status, qr_code, expires_at, paid_at, created_at, provider, pix_txid").eq("church_id", churchId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Falha ao listar contribuições: ${error.message}`);
  return z.array(Row).parse(data);
}

export async function getCharge(churchId: string, chargeId: string): Promise<ChargeItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("id, membership_id, purpose, amount_cents, status, qr_code, expires_at, paid_at, created_at, provider, pix_txid").eq("church_id", churchId).eq("id", chargeId).maybeSingle();
  if (error) throw new Error(`Falha ao carregar contribuição: ${error.message}`);
  return data === null ? null : Row.parse(data);
}

export async function memberNames(churchId: string): Promise<ReadonlyMap<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("church_directory", { p_church: churchId });
  if (error) throw new Error(`Falha ao carregar diretório: ${error.message}`);
  return new Map(z.array(Dir).parse(data).map((d) => [d.membership_id, d.display_name] as const));
}
