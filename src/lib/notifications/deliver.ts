import type { DeliveryConfig } from "@/lib/notifications/config";
import { buildEmail, sendEmail, type SendOutcome } from "@/lib/notifications/email";
import { buildPushPayload, sendPush, type PushSender, type PushSubscriptionData } from "@/lib/notifications/push";

export interface ClaimedDelivery {
  readonly deliveryId: string;
  readonly channel: "email" | "push";
  readonly title: string;
  readonly body: string | null;
  readonly linkPath: string | null;
  readonly email: string | null;
  readonly subscriptions: readonly PushSubscriptionData[];
}

export interface DeliveryStore {
  claim(limit: number): Promise<readonly ClaimedDelivery[]>;
  complete(deliveryId: string, status: "sent" | "failed" | "skipped", reason: string | null): Promise<void>;
  dropSubscription(endpoint: string): Promise<void>;
}

export interface DeliveryDeps {
  readonly store: DeliveryStore;
  readonly config: DeliveryConfig;
  readonly pushSender: PushSender | null;
  readonly send?: (config: NonNullable<DeliveryConfig["email"]>, message: { to: string; email: ReturnType<typeof buildEmail> }) => Promise<SendOutcome>;
}

export interface DeliverySummary { readonly claimed: number; readonly sent: number; readonly failed: number; readonly skipped: number }

/**
 * Processa um lote da fila. Cada entrega termina em sent/failed/skipped: o banco decide a repetição (backoff) e o limite
 * de tentativas. Canal sem configuração é "skipped" (nunca finge envio).
 */
export async function processDeliveries(deps: DeliveryDeps, limit = 25): Promise<DeliverySummary> {
  const batch = await deps.store.claim(limit);
  let sent = 0; let failed = 0; let skipped = 0;
  const send = deps.send ?? ((config, message) => sendEmail(config, message));

  for (const item of batch) {
    try {
      if (item.channel === "email") {
        if (deps.config.email === null) { await deps.store.complete(item.deliveryId, "skipped", "e-mail não configurado"); skipped += 1; continue; }
        if (item.email === null || item.email === "") { await deps.store.complete(item.deliveryId, "skipped", "sem e-mail do titular"); skipped += 1; continue; }
        // Sem URL pública o e-mail sairia sem o link de preferências (descadastro): não envia.
        if (deps.config.siteUrl === null) { await deps.store.complete(item.deliveryId, "skipped", "URL pública do app não configurada"); skipped += 1; continue; }
        const outcome = await send(deps.config.email, { to: item.email, email: buildEmail({ title: item.title, body: item.body, linkPath: item.linkPath, siteUrl: deps.config.siteUrl }) });
        if (outcome.ok) { await deps.store.complete(item.deliveryId, "sent", null); sent += 1; }
        else if (outcome.retriable) { await deps.store.complete(item.deliveryId, "failed", outcome.reason); failed += 1; }
        else { await deps.store.complete(item.deliveryId, "skipped", outcome.reason); skipped += 1; }
        continue;
      }
      if (deps.pushSender === null || deps.config.push === null) { await deps.store.complete(item.deliveryId, "skipped", "push não configurado"); skipped += 1; continue; }
      if (item.subscriptions.length === 0) { await deps.store.complete(item.deliveryId, "skipped", "sem inscrição ativa"); skipped += 1; continue; }
      const payload = buildPushPayload({ title: item.title, body: item.body, linkPath: item.linkPath });
      let delivered = 0; let retryable = false; let lastReason = "";
      for (const subscription of item.subscriptions) {
        const outcome = await sendPush(deps.pushSender, subscription, payload);
        if (outcome.ok) { delivered += 1; continue; }
        lastReason = outcome.reason;
        if (outcome.gone) await deps.store.dropSubscription(subscription.endpoint);
        else if (outcome.retriable) retryable = true;
      }
      if (delivered > 0) { await deps.store.complete(item.deliveryId, "sent", null); sent += 1; }
      else if (retryable) { await deps.store.complete(item.deliveryId, "failed", lastReason); failed += 1; }
      else { await deps.store.complete(item.deliveryId, "skipped", lastReason || "sem destino válido"); skipped += 1; }
    } catch (cause) {
      console.error("delivery_unexpected_error", item.deliveryId, cause instanceof Error ? cause.name : "unknown");
      await deps.store.complete(item.deliveryId, "failed", "erro inesperado").catch(() => undefined);
      failed += 1;
    }
  }
  return { claimed: batch.length, sent, failed, skipped };
}
