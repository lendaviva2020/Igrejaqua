"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appUrlOrNull } from "@/lib/app-url.server";
import { requireUser, resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { createPixPayment, MercadoPagoError, refundPayment } from "@/lib/payments/mercadopago";
import { buildPixBrCode, txidFromChargeId } from "@/lib/payments/pix-key";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChargeIdSchema, CreateChargeSchema, PURPOSE_LABEL } from "./schemas";
import { attachProviderPayment, attachStaticPix, markChargeCancelled } from "./provider-writes";
import { churchMercadoPagoConfig } from "./mp-accounts-store";
import { resolvePaymentMethod } from "./payment-method";
import { syncChargeFromProvider } from "./sync";

const InsertedRow = z.object({ id: z.string().uuid(), idempotency_key: z.string().uuid() });
const ReviewSchema = z.object({ chargeId: z.string().uuid(), received: z.boolean() }).strict();

/**
 * Gera o Pix de uma contribuição, SEMPRE para a conta da própria igreja:
 * Mercado Pago da igreja (confirmação automática) ou chave Pix da igreja (a tesouraria confirma).
 */
export async function createPixChargeAction(input: unknown): Promise<Result<{ chargeId: string }>> {
  const parsed = CreateChargeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const ctx = await resolveChurchContext();
  const method = await resolvePaymentMethod(ctx.churchId);
  if (method.kind === "none") return fail("UNAVAILABLE", "Contribuições online ainda não estão disponíveis nesta igreja.");
  if (!(await allow(`pix:${ctx.userId}`, 5, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pix_charges")
    .insert({ church_id: ctx.churchId, membership_id: ctx.membershipId, purpose: parsed.data.purpose, amount_cents: parsed.data.amountCents })
    .select("id, idempotency_key")
    .single();
  if (error) return fromPostgrestError(error);
  const charge = InsertedRow.parse(data);

  if (method.kind === "pix_key") {
    const txid = txidFromChargeId(charge.id);
    try {
      const brCode = buildPixBrCode({
        key: method.pixKey.key,
        recipientName: method.pixKey.recipientName,
        recipientCity: method.pixKey.recipientCity,
        amountCents: parsed.data.amountCents,
        txid,
        description: PURPOSE_LABEL[parsed.data.purpose],
      });
      await attachStaticPix({ churchId: ctx.churchId, chargeId: charge.id, brCode, txid });
    } catch (cause) {
      await markChargeCancelled(ctx.churchId, charge.id).catch(() => undefined);
      console.error("pix_key_charge_failed", cause instanceof Error ? cause.message : "erro interno");
      return fail("UNAVAILABLE", "Não foi possível gerar o Pix agora. Avise a administração da igreja.");
    }
    revalidatePath("/contribuir");
    return ok({ chargeId: charge.id });
  }

  const user = await requireUser();
  if (user.email.length === 0) {
    await markChargeCancelled(ctx.churchId, charge.id).catch(() => undefined);
    return fail("VALIDATION", "Sua conta precisa de um e-mail para gerar o Pix.");
  }
  // O Mercado Pago só aceita webhook em HTTPS público; sem URL pública, segue sem aviso (a cobrança é reconsultada).
  const webhook = await appUrlOrNull("/api/webhooks/mercadopago");
  try {
    const payment = await createPixPayment(method.cfg, {
      amountCents: parsed.data.amountCents,
      description: `${PURPOSE_LABEL[parsed.data.purpose]} — ${ctx.churchName}`.slice(0, 120),
      payerEmail: user.email,
      externalReference: charge.id,
      idempotencyKey: charge.idempotency_key,
      notificationUrl: webhook !== null && webhook.startsWith("https://") ? webhook : null,
      expiresInMinutes: 30,
    });
    await attachProviderPayment({ churchId: ctx.churchId, chargeId: charge.id, providerPaymentId: payment.providerPaymentId, qrCode: payment.qrCode, ticketUrl: payment.ticketUrl, expiresAt: payment.expiresAt });
  } catch (cause) {
    await markChargeCancelled(ctx.churchId, charge.id).catch(() => undefined);
    console.error("pix_charge_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "Não foi possível gerar o Pix agora. Tente novamente em instantes.");
  }
  revalidatePath("/contribuir");
  return ok({ chargeId: charge.id });
}

/** Consulta o Mercado Pago da igreja e atualiza o status (reforço ao webhook). Só cobranças do Mercado Pago. */
export async function refreshChargeAction(input: unknown): Promise<Result<{ refreshed: true }>> {
  const parsed = ChargeIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Cobrança inválida.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("provider, provider_payment_id").eq("church_id", ctx.churchId).eq("id", parsed.data.chargeId).maybeSingle();
  if (error) return fromPostgrestError(error);
  const row = data as { provider: string; provider_payment_id: string | null } | null;
  if (row === null) return fail("NOT_FOUND", "Cobrança não encontrada.");
  if (row.provider !== "mercadopago" || row.provider_payment_id === null) return ok({ refreshed: true }); // chave Pix: confirmação é manual
  try {
    await syncChargeFromProvider(row.provider_payment_id);
  } catch (cause) {
    console.error("pix_refresh_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "Não foi possível consultar o pagamento agora.");
  }
  revalidatePath(`/contribuir/${parsed.data.chargeId}`);
  revalidatePath("/contribuir");
  return ok({ refreshed: true });
}

/**
 * A tesouraria confirma (ou marca como não recebida) uma contribuição feita pela chave Pix da igreja,
 * depois de conferir no extrato do banco. Só a administração (RPC revalida no banco).
 */
export async function reviewPixKeyChargeAction(input: unknown): Promise<Result<{ status: "approved" | "cancelled" }>> {
  const parsed = ReviewSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração confirma contribuições.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_pix_key_charge", { p_church: ctx.churchId, p_charge: parsed.data.chargeId, p_received: parsed.data.received });
  if (error) return fromPostgrestError(error);
  revalidatePath(`/contribuir/${parsed.data.chargeId}`);
  revalidatePath("/contribuir");
  return ok({ status: data === "approved" ? "approved" : "cancelled" });
}

/**
 * Estorno total de uma contribuição confirmada pelo Mercado Pago da igreja. Somente a administração.
 * Pix pela chave da igreja não tem estorno pelo sistema: a devolução é feita pelo banco da igreja.
 */
export async function refundChargeAction(input: unknown): Promise<Result<{ refunded: true }>> {
  const parsed = ChargeIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Cobrança inválida.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração estorna contribuições.");
  if (!(await allow(`pix-refund:${ctx.userId}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("provider, provider_payment_id, status").eq("church_id", ctx.churchId).eq("id", parsed.data.chargeId).maybeSingle();
  if (error) return fromPostgrestError(error);
  if (data === null) return fail("NOT_FOUND", "Cobrança não encontrada.");
  const row = data as { provider: string; provider_payment_id: string | null; status: string };
  if (row.provider !== "mercadopago") return fail("RULE_VIOLATION", "Pix recebido pela chave da igreja é devolvido pelo app do banco da igreja.");
  if (row.status !== "approved" || row.provider_payment_id === null) return fail("CONFLICT", "Só é possível estornar contribuições confirmadas.");
  const cfg = await churchMercadoPagoConfig(ctx.churchId);
  if (cfg === null) return fail("UNAVAILABLE", "O Mercado Pago da igreja não está conectado. Reconecte em Configurações para estornar.");
  try {
    await refundPayment(cfg, row.provider_payment_id, `refund-${parsed.data.chargeId}`);
  } catch (cause) {
    console.error("pix_refund_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "O provedor não concluiu o estorno. Nada foi alterado; tente novamente.");
  }
  // O webhook também atualiza; aqui reconsultamos para refletir já. Falha nesta etapa não desfaz o estorno.
  await syncChargeFromProvider(row.provider_payment_id).catch(() => undefined);
  revalidatePath(`/contribuir/${parsed.data.chargeId}`);
  revalidatePath("/contribuir");
  return ok({ refunded: true });
}
