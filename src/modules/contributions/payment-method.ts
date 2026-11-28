import "server-only";
import { z } from "zod";
import type { MercadoPagoConfig } from "@/lib/payments/mercadopago";
import { mercadoPagoAppConfig } from "@/lib/payments/mercadopago-oauth";
import { maskPixKey, PIX_KEY_TYPES, type PixKeyType } from "@/lib/payments/pix-key";
import { loadTokenKey, TokenKeyMissingError } from "@/lib/payments/token-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { churchMercadoPagoConfig } from "./mp-accounts-store";

/**
 * Como CADA igreja recebe as contribuições. O dinheiro nunca passa pelo IGREJAQUA:
 *  1. Mercado Pago da própria igreja conectado → Pix com confirmação automática;
 *  2. senão, chave Pix da própria igreja → Pix direto no banco dela, confirmado pela tesouraria;
 *  3. senão, contribuições online desligadas.
 */

const PixKeyRow = z.object({ key_type: z.enum(PIX_KEY_TYPES), pix_key: z.string(), recipient_name: z.string(), recipient_city: z.string() });
export interface ChurchPixKey { readonly type: PixKeyType; readonly key: string; readonly recipientName: string; readonly recipientCity: string }

export async function getChurchPixKey(churchId: string): Promise<ChurchPixKey | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("church_pix_keys").select("key_type, pix_key, recipient_name, recipient_city").eq("church_id", churchId).maybeSingle();
  if (error) throw new Error(`Falha ao ler a chave Pix da igreja: ${error.message}`);
  if (data === null) return null;
  const r = PixKeyRow.parse(data);
  return { type: r.key_type, key: r.pix_key, recipientName: r.recipient_name, recipientCity: r.recipient_city };
}

export type PaymentMethod =
  | { readonly kind: "mercadopago"; readonly cfg: MercadoPagoConfig }
  | { readonly kind: "pix_key"; readonly pixKey: ChurchPixKey }
  | { readonly kind: "none" };

/** Credencial do Mercado Pago da igreja; problemas de configuração do servidor viram "não conectado". */
async function safeMercadoPagoConfig(churchId: string): Promise<MercadoPagoConfig | null> {
  try {
    return await churchMercadoPagoConfig(churchId);
  } catch (cause) {
    console.error("mp_config_unavailable", cause instanceof TokenKeyMissingError ? cause.message : "erro interno");
    return null;
  }
}

export async function resolvePaymentMethod(churchId: string): Promise<PaymentMethod> {
  const cfg = await safeMercadoPagoConfig(churchId);
  if (cfg !== null) return { kind: "mercadopago", cfg };
  const pixKey = await getChurchPixKey(churchId);
  return pixKey !== null ? { kind: "pix_key", pixKey } : { kind: "none" };
}

const StatusRow = z.object({ connected: z.boolean(), mp_user_id: z.string(), connected_at: z.string(), live_mode: z.boolean() });

export interface PaymentSetup {
  readonly pixKey: (Omit<ChurchPixKey, "key"> & { readonly maskedKey: string }) | null;
  readonly mercadoPago: { readonly mpUserId: string; readonly connectedAt: string; readonly liveMode: boolean } | null;
  /** O IGREJAQUA tem o aplicativo do Mercado Pago configurado (client id/secret + chave de cifra). */
  readonly mercadoPagoAvailable: boolean;
}

/** Resumo para as telas (sem tokens; chave de CPF mascarada). */
export async function getPaymentSetup(churchId: string): Promise<PaymentSetup> {
  const supabase = await createSupabaseServerClient();
  const [pixKey, status] = await Promise.all([getChurchPixKey(churchId), supabase.rpc("church_mercadopago_status", { p_church: churchId })]);
  if (status.error) throw new Error(`Falha ao ler a conexão do Mercado Pago: ${status.error.message}`);
  const row = z.array(StatusRow).parse(status.data)[0];
  let keyOk = true;
  try { loadTokenKey(); } catch { keyOk = false; }
  return {
    pixKey: pixKey === null ? null : { type: pixKey.type, maskedKey: maskPixKey(pixKey.type, pixKey.key), recipientName: pixKey.recipientName, recipientCity: pixKey.recipientCity },
    mercadoPago: row === undefined ? null : { mpUserId: row.mp_user_id, connectedAt: row.connected_at, liveMode: row.live_mode },
    mercadoPagoAvailable: keyOk && mercadoPagoAppConfig() !== null,
  };
}
