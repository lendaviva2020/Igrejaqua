import "server-only";
import { z } from "zod";
import type { ChargeStatus } from "@/lib/payments/charge-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * ÚNICO ponto do módulo de contribuições que usa service role (SECURITY §6, lista fechada).
 * O cliente nunca escreve status/QR/ids do provedor: a RLS só deixa criar a intenção (valor/finalidade).
 * Toda função filtra por church_id + id; nenhuma aceita dados vindos do navegador sem validação prévia.
 */

const ChargeRow = z.object({ id: z.string().uuid(), church_id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected", "cancelled", "expired", "refunded"]), amount_cents: z.number() });
export type StoredCharge = z.infer<typeof ChargeRow>;

export async function findChargeByProviderPaymentId(providerPaymentId: string): Promise<StoredCharge | null> {
  const { data, error } = await createSupabaseAdminClient().from("pix_charges").select("id, church_id, status, amount_cents").eq("provider", "mercadopago").eq("provider_payment_id", providerPaymentId).maybeSingle();
  if (error) throw new Error(`Falha ao buscar cobrança: ${error.message}`);
  return data === null ? null : ChargeRow.parse(data);
}

export async function attachProviderPayment(input: { churchId: string; chargeId: string; providerPaymentId: string; qrCode: string | null; ticketUrl: string | null; expiresAt: string | null }): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("pix_charges")
    .update({ provider_payment_id: input.providerPaymentId, qr_code: input.qrCode, ticket_url: input.ticketUrl, expires_at: input.expiresAt })
    .eq("church_id", input.churchId)
    .eq("id", input.chargeId);
  if (error) throw new Error(`Falha ao gravar pagamento do provedor: ${error.message}`);
}

/** Contribuição pela chave Pix da igreja: grava o "copia e cola" gerado e o identificador do Pix. */
export async function attachStaticPix(input: { churchId: string; chargeId: string; brCode: string; txid: string }): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("pix_charges")
    .update({ provider: "pix_key", qr_code: input.brCode, pix_txid: input.txid })
    .eq("church_id", input.churchId)
    .eq("id", input.chargeId)
    .eq("status", "pending");
  if (error) throw new Error(`Falha ao gravar o Pix da igreja: ${error.message}`);
}

export async function markChargeCancelled(churchId: string, chargeId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("pix_charges").update({ status: "cancelled" }).eq("church_id", churchId).eq("id", chargeId).eq("status", "pending");
  if (error) throw new Error(`Falha ao cancelar cobrança: ${error.message}`);
}

/** Atualização otimista: só aplica se o status ainda for `from` (não sobrescreve concorrência). Retorna true se atualizou. */
export async function applyProviderStatus(input: { churchId: string; chargeId: string; from: ChargeStatus; to: ChargeStatus; paidAt: string | null }): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient()
    .from("pix_charges")
    .update({ status: input.to, ...(input.to === "approved" ? { paid_at: input.paidAt ?? new Date().toISOString() } : {}) })
    .eq("church_id", input.churchId)
    .eq("id", input.chargeId)
    .eq("status", input.from)
    .select("id");
  if (error) throw new Error(`Falha ao atualizar cobrança: ${error.message}`);
  return (data as unknown[]).length > 0;
}
