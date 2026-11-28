"use server";

import { appUrlOrNull } from "@/lib/app-url.server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { createPixPayment, mercadoPagoConfig, MercadoPagoError, refundPayment } from "@/lib/payments/mercadopago";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChargeIdSchema, CreateChargeSchema, PURPOSE_LABEL } from "./schemas";
import { attachProviderPayment, markChargeCancelled } from "./provider-writes";
import { syncChargeFromProvider } from "./sync";

const InsertedRow = z.object({ id: z.string().uuid(), idempotency_key: z.string().uuid() });

export async function createPixChargeAction(input: unknown): Promise<Result<{ chargeId: string }>> {
  const parsed = CreateChargeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const cfg = mercadoPagoConfig();
  if (cfg === null) return fail("UNAVAILABLE", "Contribuições online ainda não estão disponíveis nesta igreja.");
  const ctx = await resolveChurchContext();
  if (!(await allow(`pix:${ctx.userId}`, 5, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.");
  const user = await requireUser();
  if (user.email.length === 0) return fail("VALIDATION", "Sua conta precisa de um e-mail para gerar o Pix.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pix_charges")
    .insert({ church_id: ctx.churchId, membership_id: ctx.membershipId, purpose: parsed.data.purpose, amount_cents: parsed.data.amountCents })
    .select("id, idempotency_key")
    .single();
  if (error) return fromPostgrestError(error);
  const charge = InsertedRow.parse(data);

  // O Mercado Pago só aceita webhook em HTTPS público; sem URL pública, segue sem notificação (a cobrança é reconsultada).
  const webhook = await appUrlOrNull("/api/webhooks/mercadopago");
  try {
    const payment = await createPixPayment(cfg, {
      amountCents: parsed.data.amountCents,
      description: `${PURPOSE_LABEL[parsed.data.purpose]} — ${ctx.churchName}`.slice(0, 120),
      payerEmail: user.email,
      externalReference: charge.id,
      idempotencyKey: charge.idempotency_key,
      notificationUrl: webhook !== null && webhook.startsWith("https://") ? webhook : null, // exige HTTPS público
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

/** Consulta o provedor e atualiza o status (fallback ao webhook). Só quem enxerga a cobrança (RLS) pode acionar. */
export async function refreshChargeAction(input: unknown): Promise<Result<{ refreshed: true }>> {
  const parsed = ChargeIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Cobrança inválida.");
  const cfg = mercadoPagoConfig();
  if (cfg === null) return fail("UNAVAILABLE", "Contribuições online não estão configuradas.");
  const ctx = await resolveChurchContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("provider_payment_id").eq("church_id", ctx.churchId).eq("id", parsed.data.chargeId).maybeSingle();
  if (error) return fromPostgrestError(error);
  const providerId = data === null ? null : (data as { provider_payment_id: string | null }).provider_payment_id;
  if (providerId === null) return fail("NOT_FOUND", "Cobrança não encontrada.");
  try {
    await syncChargeFromProvider(cfg, providerId);
  } catch (cause) {
    console.error("pix_refresh_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "Não foi possível consultar o pagamento agora.");
  }
  revalidatePath(`/contribuir/${parsed.data.chargeId}`);
  revalidatePath("/contribuir");
  return ok({ refreshed: true });
}

/**
 * Estorno total de uma contribuição confirmada. Somente a administração. O status local só passa a "estornado"
 * quando o provedor confirma (reconsulta + conferência de valor/referência); falha de rede nunca marca estorno.
 */
export async function refundChargeAction(input: unknown): Promise<Result<{ refunded: true }>> {
  const parsed = ChargeIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Cobrança inválida.");
  const cfg = mercadoPagoConfig();
  if (cfg === null) return fail("UNAVAILABLE", "Contribuições online não estão configuradas.");
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração estorna contribuições.");
  if (!(await allow(`pix-refund:${ctx.userId}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pix_charges").select("provider_payment_id, status").eq("church_id", ctx.churchId).eq("id", parsed.data.chargeId).maybeSingle();
  if (error) return fromPostgrestError(error);
  if (data === null) return fail("NOT_FOUND", "Cobrança não encontrada.");
  const row = data as { provider_payment_id: string | null; status: string };
  if (row.status !== "approved" || row.provider_payment_id === null) return fail("CONFLICT", "Só é possível estornar contribuições confirmadas.");
  try {
    await refundPayment(cfg, row.provider_payment_id, `refund-${parsed.data.chargeId}`);
  } catch (cause) {
    console.error("pix_refund_failed", cause instanceof MercadoPagoError ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "O provedor não concluiu o estorno. Nada foi alterado; tente novamente.");
  }
  // O webhook também atualiza; aqui reconsultamos para refletir já. Falha nesta etapa não desfaz o estorno.
  await syncChargeFromProvider(cfg, row.provider_payment_id).catch(() => undefined);
  revalidatePath(`/contribuir/${parsed.data.chargeId}`);
  revalidatePath("/contribuir");
  return ok({ refunded: true });
}
