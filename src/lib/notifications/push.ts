import { sendNotification, setVapidDetails } from "web-push";
import type { PushConfig } from "@/lib/notifications/config";

export interface PushSubscriptionData { readonly endpoint: string; readonly p256dh: string; readonly auth: string }

/** Carga mínima (título, texto curto e caminho interno): nada de dado pessoal sensível no push. */
export function buildPushPayload(input: { title: string; body: string | null; linkPath: string | null }): string {
  const url = input.linkPath !== null && /^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(input.linkPath) ? input.linkPath : "/notificacoes";
  return JSON.stringify({ title: input.title.slice(0, 80), body: (input.body ?? "").slice(0, 140), url });
}

export type PushOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly gone: boolean; readonly retriable: boolean; readonly reason: string };

export type PushSender = (subscription: PushSubscriptionData, payload: string) => Promise<void>;

export function createWebPushSender(config: PushConfig): PushSender {
  setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return async (subscription, payload) => {
    await sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600, urgency: "normal", timeout: 10_000 });
  };
}

export async function sendPush(sender: PushSender, subscription: PushSubscriptionData, payload: string): Promise<PushOutcome> {
  try {
    await sender(subscription, payload);
    return { ok: true };
  } catch (cause) {
    const status = typeof cause === "object" && cause !== null && "statusCode" in cause ? Number((cause as { statusCode: unknown }).statusCode) : 0;
    if (status === 404 || status === 410) return { ok: false, gone: true, retriable: false, reason: `inscrição expirada (${status})` };
    const retriable = status === 0 || status === 408 || status === 429 || status >= 500;
    return { ok: false, gone: false, retriable, reason: status === 0 ? "falha de rede" : `push HTTP ${status}` };
  }
}
