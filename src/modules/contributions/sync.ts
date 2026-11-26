import "server-only";
import { canTransition } from "@/lib/payments/charge-status";
import { getPayment, type MercadoPagoConfig } from "@/lib/payments/mercadopago";
import { applyProviderStatus, findChargeByProviderPaymentId } from "./provider-writes";

export type SyncOutcome = "updated" | "unchanged" | "unknown_payment" | "mismatch";

/**
 * Fonte da verdade = API do provedor (nunca o corpo do webhook). Confere referência externa e valor
 * antes de aceitar; estados finais não retrocedem; idempotente (webhooks repetidos não duplicam efeitos).
 */
export async function syncChargeFromProvider(cfg: MercadoPagoConfig, providerPaymentId: string): Promise<SyncOutcome> {
  const charge = await findChargeByProviderPaymentId(providerPaymentId);
  if (charge === null) return "unknown_payment";

  const payment = await getPayment(cfg, providerPaymentId);
  if (payment.externalReference !== charge.id || payment.amountCents !== charge.amount_cents) return "mismatch";
  if (!canTransition(charge.status, payment.status)) return "unchanged";

  const applied = await applyProviderStatus({ churchId: charge.church_id, chargeId: charge.id, from: charge.status, to: payment.status, paidAt: payment.approvedAt });
  return applied ? "updated" : "unchanged";
}
