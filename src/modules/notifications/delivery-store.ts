import "server-only";
import { z } from "zod";
import type { ClaimedDelivery, DeliveryStore } from "@/lib/notifications/deliver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * ÚNICO ponto do módulo de notificações que usa service role (SECURITY §6, lista fechada).
 * Só chama as três funções SQL da fila (claim/complete/drop); não lê nem grava tabelas diretamente.
 */
const Row = z.object({
  delivery_id: z.string().uuid(),
  channel: z.enum(["email", "push"]),
  title: z.string(),
  body: z.string().nullable(),
  link_path: z.string().nullable(),
  email: z.string().nullable(),
  subscriptions: z.array(z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() })).nullable(),
});

export function createDeliveryStore(): DeliveryStore {
  const client = createSupabaseAdminClient();
  return {
    async claim(limit: number): Promise<readonly ClaimedDelivery[]> {
      const { data, error } = await client.rpc("claim_notification_deliveries", { p_limit: limit });
      if (error) throw new Error(`Falha ao reservar entregas: ${error.message}`);
      return z.array(Row).parse(data).map((r) => ({ deliveryId: r.delivery_id, channel: r.channel, title: r.title, body: r.body, linkPath: r.link_path, email: r.email, subscriptions: r.subscriptions ?? [] }));
    },
    async complete(deliveryId, status, reason) {
      const { error } = await client.rpc("complete_notification_delivery", { p_id: deliveryId, p_status: status, p_error: reason ?? "" });
      if (error) throw new Error(`Falha ao concluir entrega: ${error.message}`);
    },
    async dropSubscription(endpoint) {
      const { error } = await client.rpc("drop_push_subscription", { p_endpoint: endpoint });
      if (error) throw new Error(`Falha ao remover inscrição: ${error.message}`);
    },
  };
}
