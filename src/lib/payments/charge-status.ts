export const CHARGE_STATUSES = ["pending", "approved", "rejected", "cancelled", "expired", "refunded"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/** Mapeia o status do Mercado Pago para o domínio. Estados desconhecidos permanecem `pending` (nunca aprova por engano). */
export function mapMercadoPagoStatus(status: string, statusDetail?: string | null): ChargeStatus {
  switch (status) {
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "cancelled": return statusDetail === "expired" ? "expired" : "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    default: return "pending"; // pending, in_process, authorized, in_mediation e desconhecidos
  }
}

/** Transições permitidas: aprovado só pode virar estornado; estados finais não retrocedem. */
export function canTransition(from: ChargeStatus, to: ChargeStatus): boolean {
  if (from === to) return false;
  if (from === "pending") return true;
  if (from === "approved") return to === "refunded";
  return false;
}

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  pending: "Aguardando pagamento", approved: "Confirmado", rejected: "Recusado", cancelled: "Cancelado", expired: "Expirado", refunded: "Estornado",
};
