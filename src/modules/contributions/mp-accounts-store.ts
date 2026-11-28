import "server-only";
import { z } from "zod";
import type { MercadoPagoConfig } from "@/lib/payments/mercadopago";
import { mercadoPagoAppConfig, MercadoPagoOAuthError, refreshAccessToken, type MercadoPagoTokens } from "@/lib/payments/mercadopago-oauth";
import { decryptToken, encryptToken, loadTokenKey } from "@/lib/payments/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * ÚNICO ponto que lê/grava as credenciais Mercado Pago das igrejas (service role; lista fechada do
 * SECURITY §6). A tabela nega acesso a qualquer usuário logado; os tokens ficam cifrados (AES-256-GCM).
 * Toda função recebe church_id já autorizado por quem chama (administração da igreja ou cobrança dela).
 */

const RENEW_BEFORE_MS = 7 * 24 * 3600 * 1000;
const Row = z.object({ access_token_enc: z.string(), refresh_token_enc: z.string(), token_expires_at: z.string() });

export async function saveMercadoPagoAccount(churchId: string, tokens: MercadoPagoTokens, connectedBy: string): Promise<void> {
  const key = loadTokenKey();
  const { error } = await createSupabaseAdminClient().from("church_mercadopago_accounts").upsert({
    church_id: churchId,
    mp_user_id: tokens.userId,
    access_token_enc: encryptToken(tokens.accessToken, key),
    refresh_token_enc: encryptToken(tokens.refreshToken, key),
    token_expires_at: tokens.expiresAt.toISOString(),
    live_mode: tokens.liveMode,
    connected_by: connectedBy,
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Falha ao salvar a conexão do Mercado Pago: ${error.message}`);
}

export async function deleteMercadoPagoAccount(churchId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("church_mercadopago_accounts").delete().eq("church_id", churchId);
  if (error) throw new Error(`Falha ao desconectar o Mercado Pago: ${error.message}`);
}

/**
 * Credencial da conta Mercado Pago da igreja, renovada quando faltar menos de 7 dias para vencer.
 * null = igreja sem Mercado Pago conectado (ou conexão vencida e não renovável: a igreja reconecta).
 */
export async function churchMercadoPagoConfig(churchId: string): Promise<MercadoPagoConfig | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("church_mercadopago_accounts").select("access_token_enc, refresh_token_enc, token_expires_at").eq("church_id", churchId).maybeSingle();
  if (error) throw new Error(`Falha ao ler a conexão do Mercado Pago: ${error.message}`);
  if (data === null) return null;
  const row = Row.parse(data);
  const key = loadTokenKey();
  const expiresAt = new Date(row.token_expires_at).getTime();
  const accessToken = decryptToken(row.access_token_enc, key);
  if (expiresAt - Date.now() > RENEW_BEFORE_MS) return { accessToken };

  const app = mercadoPagoAppConfig();
  if (app === null) return expiresAt > Date.now() ? { accessToken } : null;
  try {
    const renewed = await refreshAccessToken(app, decryptToken(row.refresh_token_enc, key));
    const { error: upErr } = await admin.from("church_mercadopago_accounts").update({
      access_token_enc: encryptToken(renewed.accessToken, key),
      refresh_token_enc: encryptToken(renewed.refreshToken, key),
      token_expires_at: renewed.expiresAt.toISOString(),
    }).eq("church_id", churchId);
    if (upErr) throw new Error(upErr.message);
    return { accessToken: renewed.accessToken };
  } catch (cause) {
    console.error("mp_token_refresh_failed", cause instanceof MercadoPagoOAuthError ? cause.message : "erro interno");
    // Ainda válido: segue com o atual e tenta renovar na próxima vez. Vencido: a igreja precisa reconectar.
    return expiresAt > Date.now() ? { accessToken } : null;
  }
}
